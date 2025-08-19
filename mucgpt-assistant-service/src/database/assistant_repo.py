from __future__ import annotations  # Enable forward references in annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import attributes, selectinload

from core.logtools import getLogger
from utils import serialize_list

# Import to register SQLAlchemy event listeners for subscription counting
from . import subscription_events  # noqa: F401
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
        temperature: float,
        max_output_tokens: int,
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
                temperature=temperature,
                max_output_tokens=max_output_tokens,
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
        self, department: str
    ) -> list[Assistant]:
        logger.info(f"Fetching all assistants for department: {department}")
        """Get all assistants that are allowed for a specific department.

        For example an assistant has the path:
        ITM-KM

        This means that a user from the department ITM-KM-DI is allowed to use this assistant.
        But a user from the department ITM-AB-DI is not allowed to use this assistant.
        """  # Since SQLite doesn't support ANY(), we need to implement this logic differently
        # We'll get all assistants and filter them in Python
        all_assistants_query = await self.session.execute(
            select(Assistant).where(Assistant.is_visible.is_(True))
        )
        all_assistants = list(all_assistants_query.scalars().all())

        matching_assistants = []

        for assistant in all_assistants:
            # Include assistants with no hierarchical access restrictions (available to all)
            if (
                not assistant.hierarchical_access
                or len(assistant.hierarchical_access) == 0
            ):
                matching_assistants.append(assistant)
                continue  # Check each path in the hierarchical_access array
            for path in assistant.hierarchical_access:
                # Exact match
                if department == path:
                    matching_assistants.append(assistant)
                    break

                # Prefix match with delimiter (hierarchical access)
                if department.startswith(path + "-") or department.startswith(
                    path + "/"
                ):
                    matching_assistants.append(assistant)
                    break

        logger.info(
            f"Returning {len(matching_assistants)} assistants for department: {department}"
        )
        return matching_assistants

    async def get_assistants_by_owner(self, user_id: str) -> list[Assistant]:
        logger.info(f"Fetching assistants for owner: {user_id}")
        """Get all assistants where the given user_id is an owner."""
        stmt = (
            select(Assistant)
            .join(assistant_owners, Assistant.id == assistant_owners.c.assistant_id)
            .where(assistant_owners.c.user_id == user_id)
        )

        result = await self.session.execute(stmt)
        assistants = result.scalars().all()
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
                assistant.updated_at = datetime.now(timezone.utc)
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
                        updated_at=datetime.now(timezone.utc),
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

    async def get_user_subscriptions(self, user_id: str) -> list[Assistant]:
        """Get all assistants a user has subscribed to."""
        logger.info(f"Fetching subscriptions for user {user_id}")

        try:
            # Join Subscription with Assistant to get all subscribed assistants
            result = await self.session.execute(
                select(Assistant)
                .join(Subscription, Assistant.id == Subscription.assistant_id)
                .where(Subscription.user_id == user_id)
            )

            assistants = list(result.scalars().all())
            logger.info(f"Found {len(assistants)} subscriptions for user {user_id}")
            return assistants
        except Exception as e:
            logger.error(f"Error fetching user subscriptions: {e}")
            await self.session.rollback()
            raise
