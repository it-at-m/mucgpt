from __future__ import annotations  # Enable forward references in annotations

import uuid
from datetime import datetime

from sqlalchemy import String, delete, func, insert, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, attributes, selectinload

from core.logtools import getLogger
from utils import serialize_list

from .database_models import (
    Assistant,
    AssistantVersion,
    Example,
    Owner,
    QuickPrompt,
    Subscription,
    ToolAssociation,
    assistant_owners,
)
from .path_matcher import _get_directory_index
from .repo import Repository

logger = getLogger("assistant_repo")


class AssistantRepository(Repository[Assistant]):
    def __init__(self, session: AsyncSession):
        super().__init__(Assistant, session)
        logger.debug("AssistantRepository initialized")

    def get_tools_from_version(
        self, version: AssistantVersion | None
    ) -> list[ToolAssociation]:
        """Helper function to safely get tools from an assistant version.

        Args:
            version: The assistant version to retrieve tools from

        Returns:
            A list of tool associations with id and config
        """
        logger.debug(f"Getting tools from version: {getattr(version, 'id', None)}")
        if not version:
            return []
        try:
            # Check if 'tool_associations' is loaded without triggering a lazy load
            if "tool_associations" in attributes.instance_state(version).unloaded:
                return []

            return [
                {"id": assoc.tool_id, "config": assoc.config}
                for assoc in version.tool_associations
            ]
        except Exception:
            return []

    async def get_assistant_version(
        self, assistant_id: str, version: int
    ) -> AssistantVersion | None:
        logger.info(
            f"Fetching assistant version {version} for assistant {assistant_id}"
        )
        """Gets a specific version of an assistant."""
        result = await self.session.execute(
            select(AssistantVersion)
            .options(selectinload(AssistantVersion.tool_associations))
            .filter_by(assistant_id=assistant_id, version=version)
        )
        return result.scalars().first()

    async def create_assistant_version(
        self,
        assistant: Assistant,
        name: str,
        system_prompt: str,
        description: str,
        creativity: str,
        default_model: str | None = None,
        examples: list[Example] | None = None,
        quick_prompts: list[QuickPrompt] | None = None,
        tags: list[str] | None = None,
    ) -> AssistantVersion:
        """Creates a new version for an assistant with explicit parameters."""
        logger.info(f"Creating new version for assistant {assistant.id}")
        try:
            # Query for the latest version directly to avoid lazy loading
            result = await self.session.execute(
                select(AssistantVersion)
                .filter(AssistantVersion.assistant_id == assistant.id)
                .order_by(AssistantVersion.version.desc())
                .limit(1)
            )
            latest_version = result.scalars().first()
            new_version_number = latest_version.version + 1 if latest_version else 1
            serialized_examples = serialize_list(examples or [])
            serialized_quick_prompts = serialize_list(quick_prompts or [])
            new_version = AssistantVersion(
                assistant=assistant,
                version=new_version_number,
                name=name,
                description=description,
                system_prompt=system_prompt,
                creativity=creativity,
                default_model=default_model,
                examples=serialized_examples,
                quick_prompts=serialized_quick_prompts,
                tags=tags or [],
            )

            self.session.add(new_version)
            await self.session.flush()
            await self.session.refresh(new_version)
            logger.info(
                f"Created version {new_version.version} for assistant {assistant.id}"
            )
            return new_version
        except Exception as e:
            logger.error(f"Error creating assistant version for {assistant.id}: {e}")
            await self.session.rollback()
            raise

    async def get_all_possible_assistants_for_user_with_department(
        self,
        department: str,
        search: str | None = None,
        sort_by: str = "subscriptions",
        sort_order: str = "desc",
        offset: int = 0,
        limit: int | None = None,
        exclude_owned_by_user_id: str | None = None,
        exclude_subscribed_by_user_id: str | None = None,
    ) -> list[Assistant]:
        logger.info(f"Fetching all assistants for department: {department}")
        """Get all assistants that are allowed for a specific department.

        For example an assistant has the path:
        ITM-KM

        This means that a user from the department ITM-KM-DI is allowed to use this assistant.
        But a user from the department ITM-AB-DI is not allowed to use this assistant.
        """  # Since SQLite doesn't support ANY(), we need to implement this logic differently
        # We'll get all assistants and filter them in Python
        latest_version_subquery = (
            select(
                AssistantVersion.assistant_id.label("assistant_id"),
                func.max(AssistantVersion.version).label("max_version"),
            )
            .group_by(AssistantVersion.assistant_id)
            .subquery()
        )
        latest_version_alias = aliased(AssistantVersion)

        candidate_stmt = (
            select(Assistant)
            .outerjoin(
                latest_version_subquery,
                latest_version_subquery.c.assistant_id == Assistant.id,
            )
            .outerjoin(
                latest_version_alias,
                (latest_version_alias.assistant_id == Assistant.id)
                & (
                    latest_version_alias.version
                    == latest_version_subquery.c.max_version
                ),
            )
            .where(Assistant.is_visible.is_(True))
        )

        if exclude_owned_by_user_id:
            owned_assistant_ids = select(assistant_owners.c.assistant_id).where(
                assistant_owners.c.user_id == exclude_owned_by_user_id
            )
            candidate_stmt = candidate_stmt.where(
                Assistant.id.not_in(owned_assistant_ids)
            )

        if exclude_subscribed_by_user_id:
            subscribed_assistant_ids = select(Subscription.assistant_id).where(
                Subscription.user_id == exclude_subscribed_by_user_id
            )
            candidate_stmt = candidate_stmt.where(
                Assistant.id.not_in(subscribed_assistant_ids)
            )

        candidate_stmt = self._apply_search_filters_sql(
            candidate_stmt, latest_version_alias, search
        )
        candidate_stmt = self._apply_sort_sql(
            candidate_stmt, latest_version_alias, sort_by, sort_order
        )

        candidate_result = await self.session.execute(candidate_stmt)
        candidate_assistants = list(candidate_result.scalars().all())

        accessible_assistant_ids: list[str] = []
        directory_index = await _get_directory_index()

        for assistant in candidate_assistants:
            if await assistant.is_allowed_for_user(
                department,
                directory_index=directory_index,
            ):
                accessible_assistant_ids.append(str(assistant.id))

        paged_assistant_ids = self._slice_assistants(
            accessible_assistant_ids, offset=offset, limit=limit
        )

        if not paged_assistant_ids:
            logger.info(
                "Returning 0 assistants for department: %s after accessibility and pagination",
                department,
            )
            return []

        paged_stmt = (
            select(Assistant)
            .options(
                selectinload(Assistant.owners),
                selectinload(Assistant.versions).selectinload(
                    AssistantVersion.tool_associations
                ),
            )
            .where(Assistant.id.in_(paged_assistant_ids))
        )

        paged_result = await self.session.execute(paged_stmt)
        matching_assistants = list(paged_result.scalars().all())
        position_by_id = {
            assistant_id: index
            for index, assistant_id in enumerate(paged_assistant_ids)
        }
        matching_assistants.sort(
            key=lambda assistant: position_by_id.get(str(assistant.id), 0)
        )

        logger.info(
            f"Returning {len(matching_assistants)} assistants for department: {department}"
        )
        return matching_assistants

    async def get_assistants_by_owner(
        self,
        user_id: str,
        search: str | None = None,
        sort_by: str = "updated",
        sort_order: str = "desc",
        offset: int = 0,
        limit: int | None = None,
    ) -> list[Assistant]:
        logger.info(f"Fetching assistants for owner: {user_id}")
        """Get all assistants where the given user_id is an owner."""
        latest_version_subquery = (
            select(
                AssistantVersion.assistant_id.label("assistant_id"),
                func.max(AssistantVersion.version).label("max_version"),
            )
            .group_by(AssistantVersion.assistant_id)
            .subquery()
        )
        latest_version_alias = aliased(AssistantVersion)

        stmt = (
            select(Assistant)
            .options(
                selectinload(Assistant.owners),
                selectinload(Assistant.versions).selectinload(
                    AssistantVersion.tool_associations
                ),
            )
            .join(assistant_owners, Assistant.id == assistant_owners.c.assistant_id)
            .outerjoin(
                latest_version_subquery,
                latest_version_subquery.c.assistant_id == Assistant.id,
            )
            .outerjoin(
                latest_version_alias,
                (latest_version_alias.assistant_id == Assistant.id)
                & (
                    latest_version_alias.version
                    == latest_version_subquery.c.max_version
                ),
            )
            .where(assistant_owners.c.user_id == user_id)
        )

        stmt = self._apply_search_filters_sql(stmt, latest_version_alias, search)
        stmt = self._apply_sort_sql(stmt, latest_version_alias, sort_by, sort_order)
        if offset > 0:
            stmt = stmt.offset(offset)
        if limit is not None:
            stmt = stmt.limit(limit)

        result = await self.session.execute(stmt)
        assistants = list(result.scalars().all())
        logger.info(f"Returning {len(assistants)} assistants for owner: {user_id}")
        return list(assistants)

    async def is_owner(self, assistant_id: str, user_id: str) -> bool:
        logger.debug(f"Checking if {user_id} is owner of assistant {assistant_id}")
        """Check if the given user_id is an owner of the specified assistant."""
        stmt = (
            select(assistant_owners)
            .where(assistant_owners.c.assistant_id == assistant_id)
            .where(assistant_owners.c.user_id == user_id)
        )

        result = await self.session.execute(stmt)
        return result.first() is not None

    async def create(
        self,
        hierarchical_access: list[str] | None = None,
        owner_ids: list[str] | None = None,
        is_visible: bool = True,
    ) -> Assistant:
        """Create a new assistant with explicit parameters."""
        logger.info(f"Creating assistant with owners: {owner_ids}")
        try:
            # Generate a UUID version 4 (random) for the assistant
            assistant_id = str(uuid.uuid4())  # Using version 4 (random) UUID
            # Clean hierarchical_access: remove empty strings, None values, and whitespace-only strings
            cleaned_hierarchical_access = []
            if hierarchical_access:
                cleaned_hierarchical_access = [
                    path.strip()
                    for path in hierarchical_access
                    if path is not None and str(path).strip()
                ]

            assistant = Assistant(
                id=assistant_id,
                hierarchical_access=cleaned_hierarchical_access,
                is_visible=is_visible,
            )
            self.session.add(assistant)

            # Flush to get the assistant ID
            await self.session.flush()

            # Add owners if specified
            if owner_ids:
                # Create owners and associations
                for owner_id in owner_ids:
                    # Get or create the Owner
                    result = await self.session.execute(
                        select(Owner).filter(Owner.user_id == owner_id)
                    )
                    owner = result.scalars().first()
                    if not owner:
                        owner = Owner(user_id=owner_id)
                        self.session.add(owner)
                        await self.session.flush()  # Ensure owner is persisted                    # Create association directly using insert
                    stmt = insert(assistant_owners).values(
                        assistant_id=assistant.id, user_id=owner.user_id
                    )
                    await self.session.execute(stmt)

            await self.session.flush()
            await self.session.refresh(assistant)
            logger.info(f"Created assistant with ID: {assistant.id}")
            return assistant
        except Exception as e:
            logger.error(f"Error creating assistant: {e}")
            await self.session.rollback()
            raise

    async def update(
        self,
        assistant_id: str,
        hierarchical_access: list[str] | None = None,
        owner_ids: list[str] | None = None,
        is_visible: bool = None,
    ) -> Assistant | None:
        logger.info(f"Updating assistant {assistant_id}")
        """Update an assistant with explicit parameters."""
        try:
            assistant = await self.get(assistant_id)
            if assistant:
                if hierarchical_access is not None:
                    # Clean hierarchical_access: remove empty strings, None values, and whitespace-only strings
                    cleaned_hierarchical_access = [
                        path.strip()
                        for path in hierarchical_access
                        if path is not None and str(path).strip()
                    ]
                    assistant.hierarchical_access = cleaned_hierarchical_access

                if is_visible is not None:
                    assistant.is_visible = is_visible

                if owner_ids is not None:
                    # Clear existing owners using direct delete
                    delete_stmt = delete(assistant_owners).where(
                        assistant_owners.c.assistant_id == assistant_id
                    )
                    await self.session.execute(delete_stmt)

                    # Add new owners
                    for owner_id in owner_ids:
                        # Get or create the Owner
                        result = await self.session.execute(
                            select(Owner).filter(Owner.user_id == owner_id)
                        )
                        owner = result.scalars().first()
                        if not owner:
                            owner = Owner(user_id=owner_id)
                            self.session.add(owner)
                            await self.session.flush()  # Ensure owner is persisted

                        # Create association directly using insert
                        stmt = insert(assistant_owners).values(
                            assistant_id=assistant.id, user_id=owner.user_id
                        )
                        await self.session.execute(stmt)

                # Always bump the updated_at so API clients see a change even if only owners or related tables changed
                assistant.updated_at = datetime.now()
                await self.session.flush()
                await self.session.refresh(assistant)
                logger.info(f"Updated assistant {assistant_id}")
                return assistant
            return None
        except Exception as e:
            logger.error(f"Error updating assistant {assistant_id}: {e}")
            await self.session.rollback()
            raise

    async def get_with_owners(self, assistant_id: str) -> Assistant | None:
        logger.debug(f"Fetching assistant with owners for assistant {assistant_id}")
        """Get assistant with eagerly loaded owners."""
        result = await self.session.execute(
            select(Assistant)
            .options(selectinload(Assistant.owners))
            .filter(Assistant.id == assistant_id)
        )
        return result.scalars().first()

    async def get_owners_count(self, assistant_id: str) -> int:
        logger.debug(f"Getting owners count for assistant {assistant_id}")
        """Get the count of owners for an assistant."""
        result = await self.session.execute(
            select(func.count(assistant_owners.c.user_id)).where(
                assistant_owners.c.assistant_id == assistant_id
            )
        )
        return result.scalar() or 0

    async def get_latest_version(self, assistant_id: str) -> AssistantVersion | None:
        logger.info(f"Fetching latest version for assistant {assistant_id}")
        """Get the latest version for an assistant safely without lazy loading."""
        try:
            result = await self.session.execute(
                select(AssistantVersion)
                .options(selectinload(AssistantVersion.tool_associations))
                .filter(AssistantVersion.assistant_id == assistant_id)
                .order_by(AssistantVersion.version.desc())
                .limit(1)
            )
            return result.scalars().first()
        except Exception as e:
            logger.error(
                f"Error fetching latest version for assistant {assistant_id}: {e}"
            )
            await self.session.rollback()
            raise

    async def is_user_subscribed(self, assistant_id: str, user_id: str) -> bool:
        """Check if a user is subscribed to an assistant."""
        logger.debug(
            f"Checking if user {user_id} is subscribed to assistant {assistant_id}"
        )

        result = await self.session.execute(
            select(Subscription)
            .filter(Subscription.assistant_id == assistant_id)
            .filter(Subscription.user_id == user_id)
        )
        subscription = result.scalars().first()

        return subscription is not None

    async def create_subscription(
        self, assistant_id: str, user_id: str
    ) -> Subscription:
        """Create a subscription for a user to an assistant."""
        logger.info(
            f"Creating subscription for user {user_id} to assistant {assistant_id}"
        )

        try:
            subscription = Subscription(assistant_id=assistant_id, user_id=user_id)
            self.session.add(subscription)
            await self.session.flush()
            await self.session.refresh(subscription)

            # Manually increment the counter since events might not be reliable
            await self.session.execute(
                update(Assistant)
                .where(Assistant.id == assistant_id)
                .values(
                    subscriptions_count=Assistant.subscriptions_count + 1,
                    updated_at=datetime.now(),
                )
            )

            logger.info(
                f"Created subscription for user {user_id} to assistant {assistant_id}"
            )
            return subscription
        except Exception as e:
            logger.error(f"Error creating subscription: {e}")
            await self.session.rollback()
            raise

    async def remove_subscription(self, assistant_id: str, user_id: str) -> bool:
        """Remove a user's subscription to an assistant."""
        logger.info(
            f"Removing subscription for user {user_id} from assistant {assistant_id}"
        )

        try:
            # First check if the subscription exists
            existing_subscription = await self.session.execute(
                select(Subscription)
                .where(Subscription.assistant_id == assistant_id)
                .where(Subscription.user_id == user_id)
            )
            subscription = existing_subscription.scalars().first()

            if not subscription:
                logger.info(
                    f"No subscription found for user {user_id} to assistant {assistant_id}"
                )
                return False

            # Delete the subscription
            result = await self.session.execute(
                delete(Subscription)
                .where(Subscription.assistant_id == assistant_id)
                .where(Subscription.user_id == user_id)
            )

            rows_deleted = result.rowcount

            # Manually decrement the counter since events might not be reliable
            if rows_deleted > 0:
                await self.session.execute(
                    update(Assistant)
                    .where(Assistant.id == assistant_id)
                    .values(
                        subscriptions_count=Assistant.subscriptions_count
                        - rows_deleted,
                        updated_at=datetime.now(),
                    )
                )

            logger.info(
                f"Removed {rows_deleted} subscription(s) for user {user_id} from assistant {assistant_id}"
            )
            return rows_deleted > 0
        except Exception as e:
            logger.error(f"Error removing subscription: {e}")
            await self.session.rollback()
            raise

    async def get_user_subscriptions(
        self,
        user_id: str,
        search: str | None = None,
        sort_by: str = "updated",
        sort_order: str = "desc",
        offset: int = 0,
        limit: int | None = None,
    ) -> list[Assistant]:
        """Get all assistants a user has subscribed to."""
        logger.info(f"Fetching subscriptions for user {user_id}")

        try:
            latest_version_subquery = (
                select(
                    AssistantVersion.assistant_id.label("assistant_id"),
                    func.max(AssistantVersion.version).label("max_version"),
                )
                .group_by(AssistantVersion.assistant_id)
                .subquery()
            )
            latest_version_alias = aliased(AssistantVersion)

            # Join Subscription with Assistant to get all subscribed assistants
            stmt = (
                select(Assistant)
                .options(
                    selectinload(Assistant.owners),
                    selectinload(Assistant.versions).selectinload(
                        AssistantVersion.tool_associations
                    ),
                )
                .join(Subscription, Assistant.id == Subscription.assistant_id)
                .outerjoin(
                    latest_version_subquery,
                    latest_version_subquery.c.assistant_id == Assistant.id,
                )
                .outerjoin(
                    latest_version_alias,
                    (latest_version_alias.assistant_id == Assistant.id)
                    & (
                        latest_version_alias.version
                        == latest_version_subquery.c.max_version
                    ),
                )
                .where(Subscription.user_id == user_id)
            )

            stmt = self._apply_search_filters_sql(stmt, latest_version_alias, search)
            stmt = self._apply_sort_sql(stmt, latest_version_alias, sort_by, sort_order)
            if offset > 0:
                stmt = stmt.offset(offset)
            if limit is not None:
                stmt = stmt.limit(limit)

            result = await self.session.execute(stmt)

            assistants = list(result.scalars().all())
            logger.info(f"Found {len(assistants)} subscriptions for user {user_id}")
            return assistants
        except Exception as e:
            logger.error(f"Error fetching user subscriptions: {e}")
            await self.session.rollback()
            raise

    def _slice_assistants(
        self,
        assistants: list[str],
        offset: int = 0,
        limit: int | None = None,
    ) -> list[str]:
        if offset < 0:
            offset = 0
        if limit is None:
            return assistants[offset:]
        return assistants[offset : offset + max(limit, 0)]

    def _assistant_latest_version(
        self, assistant: Assistant
    ) -> AssistantVersion | None:
        if not assistant.versions:
            return None
        return assistant.versions[0]

    def _assistant_title(self, assistant: Assistant) -> str:
        latest_version = self._assistant_latest_version(assistant)
        return (
            latest_version.name if latest_version and latest_version.name else ""
        ).lower()

    def _assistant_description(self, assistant: Assistant) -> str:
        latest_version = self._assistant_latest_version(assistant)
        return (
            latest_version.description.lower()
            if latest_version and latest_version.description
            else ""
        )

    def _assistant_tags(self, assistant: Assistant) -> list[str]:
        latest_version = self._assistant_latest_version(assistant)
        if not latest_version or not latest_version.tags:
            return []
        return [str(tag).lower() for tag in latest_version.tags]

    def _filter_assistants_by_search(
        self, assistants: list[Assistant], search: str | None
    ) -> list[Assistant]:
        if not search:
            return assistants

        normalized_search = search.strip().lower()
        if not normalized_search:
            return assistants

        filtered: list[Assistant] = []
        for assistant in assistants:
            if normalized_search in self._assistant_title(assistant):
                filtered.append(assistant)
                continue
            if normalized_search in self._assistant_description(assistant):
                filtered.append(assistant)
                continue
            if any(normalized_search in tag for tag in self._assistant_tags(assistant)):
                filtered.append(assistant)

        return filtered

    def _sort_assistants(
        self,
        assistants: list[Assistant],
        sort_by: str,
        sort_order: str,
    ) -> list[Assistant]:
        normalized_sort_by = (sort_by or "updated").lower()
        reverse = (sort_order or "desc").lower() != "asc"

        if normalized_sort_by == "title":
            return sorted(assistants, key=self._assistant_title, reverse=reverse)

        if normalized_sort_by == "subscriptions":
            return sorted(
                assistants,
                key=lambda assistant: (
                    getattr(assistant, "subscriptions_count", 0) or 0,
                    getattr(assistant, "updated_at", datetime.min),
                ),
                reverse=reverse,
            )

        return sorted(
            assistants,
            key=lambda assistant: (
                getattr(assistant, "updated_at", datetime.min),
                self._assistant_title(assistant),
            ),
            reverse=reverse,
        )

    def _apply_search_filters_sql(self, stmt, latest_version_alias, search: str | None):
        if not search:
            return stmt

        normalized_search = search.strip()
        if not normalized_search:
            return stmt

        pattern = f"%{normalized_search}%"
        return stmt.where(
            or_(
                latest_version_alias.name.ilike(pattern),
                latest_version_alias.description.ilike(pattern),
                func.lower(
                    func.coalesce(latest_version_alias.tags.cast(String), "")
                ).ilike(f"%{normalized_search.lower()}%"),
            )
        )

    def _apply_sort_sql(
        self, stmt, latest_version_alias, sort_by: str, sort_order: str
    ):
        normalized_sort_by = (sort_by or "updated").lower()
        order_desc = (sort_order or "desc").lower() != "asc"

        if normalized_sort_by == "title":
            title_order = func.lower(func.coalesce(latest_version_alias.name, ""))
            return stmt.order_by(
                title_order.desc() if order_desc else title_order.asc()
            )

        if normalized_sort_by == "subscriptions":
            primary = (
                Assistant.subscriptions_count.desc()
                if order_desc
                else Assistant.subscriptions_count.asc()
            )
            secondary = (
                Assistant.updated_at.desc()
                if order_desc
                else Assistant.updated_at.asc()
            )
            return stmt.order_by(primary, secondary)

        primary = (
            Assistant.updated_at.desc() if order_desc else Assistant.updated_at.asc()
        )
        secondary = func.lower(func.coalesce(latest_version_alias.name, ""))
        return stmt.order_by(
            primary, secondary.desc() if order_desc else secondary.asc()
        )
