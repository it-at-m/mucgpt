from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .database_models import Assistant, AssistantVersion, assistant_owners
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
        self, assistant: Assistant, **kwargs
    ) -> AssistantVersion:
        """Creates a new version for an assistant."""
        latest_version = assistant.latest_version
        new_version_number = latest_version.version + 1 if latest_version else 1

        # Create a new version
        new_version = AssistantVersion(
            assistant=assistant, version=new_version_number, **kwargs
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
        """
        # Query for assistants where:
        # Either hierarchical_access is None/empty (available to all) OR
        # the department starts with the hierarchical_access
        query = self.session.query(Assistant).filter(
            Assistant.hierarchical_access.is_(None)
            | (Assistant.hierarchical_access == "")
            | (
                func.substr(department, 1, func.length(Assistant.hierarchical_access))
                == Assistant.hierarchical_access
            )
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
