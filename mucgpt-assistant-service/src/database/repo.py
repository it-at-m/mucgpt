from typing import Generic, Type

from sqlalchemy.orm import Session

from .database_models import ModelType


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
