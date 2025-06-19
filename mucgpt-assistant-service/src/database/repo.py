from typing import Generic, Type

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .database_models import Assistant, ModelType, assistant_owners

# Removed User class


class Repository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType], session: Session):
        self.model = model
        self.session = session

    def create(self, **kwargs) -> ModelType:
        instance = self.model(**kwargs)
        self.session.add(instance)
        self.session.commit()
        self.session.refresh(instance)
        return instance

    def get(self, id_value) -> ModelType | None:
        # Assuming the primary key column is named 'id'
        return self.session.query(self.model).filter(self.model.id == id_value).first()

    def get_all(self) -> list[ModelType]:
        return self.session.query(self.model).all()

    def update(self, id_value, **kwargs) -> ModelType | None:
        instance = self.get(id_value)
        if instance:
            for key, value in kwargs.items():
                setattr(instance, key, value)
            self.session.commit()
            self.session.refresh(instance)
            return instance
        return None

    def delete(self, id_value) -> bool:
        instance = self.get(id_value)
        if instance:
            self.session.delete(instance)
            self.session.commit()
            return True
        return False

    def get_all_possible_assistants_for_user_with_department(
        self, department: str
    ) -> list[Assistant]:
        """Get all assistants that are allowed for a specific department.

        for example an assistant has the path:
        ITM-KM

        This means that a user from the department ITM-KM-DI is allowed to use this assistant.
        But a user from the department ITM-AB-DI is not allowed to use this assistant.
        """
        if self.model != Assistant:
            raise ValueError("This method can only be used with the Assistant model")

        # Query for assistants where:
        # Either hierarchical_access is None/empty (available to all) OR
        # the department starts with the hierarchical_access
        query = self.session.query(Assistant).filter(
            Assistant.hierarchical_access.is_(None),
            Assistant.hierarchical_access == "",
            func.substr(department, 1, func.length(Assistant.hierarchical_access))
            == Assistant.hierarchical_access,
        )

        return query.all()

    def get_assistants_by_owner(self, lhmobjektID: str) -> list[Assistant]:
        """Get all assistants where the given lhmobjektID is an owner."""
        if self.model != Assistant:
            raise ValueError("This method can only be used with the Assistant model")

        stmt = (
            select(Assistant)
            .join(assistant_owners, Assistant.id == assistant_owners.c.assistant_id)
            .where(assistant_owners.c.lhmobjektID == lhmobjektID)
        )

        return list(self.session.execute(stmt).scalars().all())
