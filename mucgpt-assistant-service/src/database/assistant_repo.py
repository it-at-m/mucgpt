from sqlalchemy import select
from sqlalchemy.orm import Session

from .database_models import Assistant, AssistantVersion, Owner, assistant_owners
from .repo import Repository


class AssistantRepository(Repository[Assistant]):
    def __init__(self, session: Session):
        super().__init__(Assistant, session)

    def get_assistant_version(
        self, assistant_id: int, version: int
    ) -> AssistantVersion | None:
        """Gets a specific version of an assistant."""
        return (
            self.session.query(AssistantVersion)
            .filter_by(assistant_id=assistant_id, version=version)
            .first()
        )

    def create_assistant_version(
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
        latest_version = assistant.latest_version
        new_version_number = latest_version.version + 1 if latest_version else 1

        # Create a new version
        new_version = AssistantVersion(
            assistant=assistant,
            version=new_version_number,
            name=name,
            description=description,
            system_prompt=system_prompt,
            temperature=temperature,
            max_output_tokens=max_output_tokens,
            examples=examples or [],
            quick_prompts=quick_prompts or [],
            tags=tags or [],
        )
        self.session.add(new_version)
        self.session.commit()
        self.session.refresh(new_version)
        return new_version

    def get_all_possible_assistants_for_user_with_department(
        self, department: str
    ) -> list[Assistant]:
        """Get all assistants that are allowed for a specific department.

        for example an assistant has the path:
        ITM-KM

        This means that a user from the department ITM-KM-DI is allowed to use this assistant.
        But a user from the department ITM-AB-DI is not allowed to use this assistant.
        """  # Query for assistants where:
        # Either hierarchical_access is None/empty (available to all) OR
        # the department matches exactly OR department starts with hierarchical_access followed by a delimiter
        from sqlalchemy import literal

        query = self.session.query(Assistant).filter(
            Assistant.hierarchical_access.is_(None)
            | (Assistant.hierarchical_access == "")
            | (Assistant.hierarchical_access == department)
            | literal(department).like(Assistant.hierarchical_access + "-%")
        )

        return query.all()

    def get_assistants_by_owner(self, lhmobjektID: str) -> list[Assistant]:
        """Get all assistants where the given lhmobjektID is an owner."""
        stmt = (
            select(Assistant)
            .join(assistant_owners, Assistant.id == assistant_owners.c.assistant_id)
            .where(assistant_owners.c.lhmobjektID == lhmobjektID)
        )

        return list(self.session.execute(stmt).scalars().all())

    def create(
        self, hierarchical_access: str = "", owner_ids: list[str] = None
    ) -> Assistant:
        """Create a new assistant with explicit parameters."""
        assistant = Assistant(hierarchical_access=hierarchical_access)
        self.session.add(assistant)

        # Add owners if specified
        if owner_ids:
            for owner_id in owner_ids:
                # Get or create the Owner
                owner = (
                    self.session.query(Owner)
                    .filter(Owner.lhmobjektID == owner_id)
                    .first()
                )
                if not owner:
                    owner = Owner(lhmobjektID=owner_id)
                    self.session.add(owner)
                assistant.owners.append(owner)

        self.session.commit()
        self.session.refresh(assistant)
        return assistant

    def update(
        self,
        assistant_id: int,
        hierarchical_access: str = None,
        owner_ids: list[str] = None,
    ) -> Assistant | None:
        """Update an assistant with explicit parameters."""
        assistant = self.get(assistant_id)
        if assistant:
            if hierarchical_access is not None:
                assistant.hierarchical_access = hierarchical_access

            if owner_ids is not None:
                # Clear existing owners and add new ones
                assistant.owners.clear()
                for owner_id in owner_ids:
                    # Get or create the Owner
                    owner = (
                        self.session.query(Owner)
                        .filter(Owner.lhmobjektID == owner_id)
                        .first()
                    )
                    if not owner:
                        owner = Owner(lhmobjektID=owner_id)
                        self.session.add(owner)
                    assistant.owners.append(owner)

            self.session.commit()
            self.session.refresh(assistant)
            return assistant
        return None
