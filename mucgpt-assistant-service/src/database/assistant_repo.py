import uuid
from typing import List, Optional

from sqlalchemy import delete, func, insert, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from utils import serialize_list

from .database_models import Assistant, AssistantVersion, Owner, assistant_owners
from .repo import Repository


class AssistantRepository(Repository[Assistant]):
    def __init__(self, session: AsyncSession):
        super().__init__(Assistant, session)

    def get_tools_from_version(self, version):
        """Helper function to safely get tools from an assistant version."""
        try:
            if hasattr(version, "tool_associations") and version.tool_associations:
                # If the tool_associations are already loaded, use them directly
                return [
                    {"id": assoc.tool_id, "config": assoc.config}
                    for assoc in version.tool_associations
                ]
            elif hasattr(version, "tools") and callable(version.tools):
                # This might cause issues with async/greenlet if the associations aren't loaded
                # So we'll return an empty list instead of trying to lazy load
                return []
        except Exception:
            # If any errors occur, return an empty list
            return []
        return []

    async def get_assistant_version(
        self, assistant_id: str, version: int
    ) -> Optional[AssistantVersion]:
        """Gets a specific version of an assistant."""
        result = await self.session.execute(
            select(AssistantVersion).filter_by(
                assistant_id=assistant_id, version=version
            )
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
        examples: list = [],
        quick_prompts: list = [],
        tags: list = [],
    ) -> AssistantVersion:
        """Creates a new version for an assistant with explicit parameters."""
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
            serialized_examples = serialize_list(examples)
            serialized_quick_prompts = serialize_list(quick_prompts)
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
            return new_version
        except Exception:
            await self.session.rollback()
            raise

    async def get_all_possible_assistants_for_user_with_department(
        self, department: str
    ) -> List[Assistant]:
        """Get all assistants that are allowed for a specific department.

        For example an assistant has the path:
        ITM-KM

        This means that a user from the department ITM-KM-DI is allowed to use this assistant.
        But a user from the department ITM-AB-DI is not allowed to use this assistant.
        """

        # Since SQLite doesn't support ANY(), we need to implement this logic differently
        # We'll get all assistants and filter them in Python
        all_assistants_query = await self.session.execute(select(Assistant))
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

        return matching_assistants

    async def get_assistants_by_owner(self, lhmobjektID: str) -> List[Assistant]:
        """Get all assistants where the given lhmobjektID is an owner."""
        stmt = (
            select(Assistant)
            .join(assistant_owners, Assistant.id == assistant_owners.c.assistant_id)
            .where(assistant_owners.c.lhmobjektID == lhmobjektID)
        )

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def is_owner(self, assistant_id: str, lhmobjektID: str) -> bool:
        """Check if the given lhmobjektID is an owner of the specified assistant."""
        stmt = (
            select(assistant_owners)
            .where(assistant_owners.c.assistant_id == assistant_id)
            .where(assistant_owners.c.lhmobjektID == lhmobjektID)
        )

        result = await self.session.execute(stmt)
        return result.first() is not None

    async def create(
        self, hierarchical_access: List[str] = None, owner_ids: List[str] = None
    ) -> Assistant:
        """Create a new assistant with explicit parameters."""
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
                id=assistant_id, hierarchical_access=cleaned_hierarchical_access
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
                        select(Owner).filter(Owner.lhmobjektID == owner_id)
                    )
                    owner = result.scalars().first()
                    if not owner:
                        owner = Owner(lhmobjektID=owner_id)
                        self.session.add(owner)
                        await self.session.flush()  # Ensure owner is persisted                    # Create association directly using insert
                    stmt = insert(assistant_owners).values(
                        assistant_id=assistant.id, lhmobjektID=owner.lhmobjektID
                    )
                    await self.session.execute(stmt)

            await self.session.flush()
            await self.session.refresh(assistant)
            return assistant
        except Exception:
            await self.session.rollback()
            raise

    async def update(
        self,
        assistant_id: str,
        hierarchical_access: List[str] = None,
        owner_ids: List[str] = None,
    ) -> Optional[Assistant]:
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
                            select(Owner).filter(Owner.lhmobjektID == owner_id)
                        )
                        owner = result.scalars().first()
                        if not owner:
                            owner = Owner(lhmobjektID=owner_id)
                            self.session.add(owner)
                            await self.session.flush()  # Ensure owner is persisted

                        # Create association directly using insert
                        stmt = insert(assistant_owners).values(
                            assistant_id=assistant.id, lhmobjektID=owner.lhmobjektID
                        )
                        await self.session.execute(stmt)

                await self.session.flush()
                await self.session.refresh(assistant)
                return assistant
            return None
        except Exception:
            await self.session.rollback()
            raise

    async def get_with_owners(self, assistant_id: str) -> Optional[Assistant]:
        """Get assistant with eagerly loaded owners."""
        result = await self.session.execute(
            select(Assistant)
            .options(selectinload(Assistant.owners))
            .filter(Assistant.id == assistant_id)
        )
        return result.scalars().first()

    async def get_owners_count(self, assistant_id: str) -> int:
        """Get the count of owners for an assistant."""
        result = await self.session.execute(
            select(func.count(assistant_owners.c.lhmobjektID)).where(
                assistant_owners.c.assistant_id == assistant_id
            )
        )
        return result.scalar() or 0

    async def get_latest_version(self, assistant_id: str) -> Optional[AssistantVersion]:
        """Get the latest version for an assistant safely without lazy loading."""
        try:
            result = await self.session.execute(
                select(AssistantVersion)
                .filter(AssistantVersion.assistant_id == assistant_id)
                .order_by(AssistantVersion.version.desc())
                .limit(1)
            )
            return result.scalars().first()
        except Exception:
            await self.session.rollback()
            raise
