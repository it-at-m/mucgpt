from typing import Generic, List, Optional, Type

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from .database_models import ModelType


class Repository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType], session: AsyncSession):
        self.model = model
        self.session = session

    async def create(self, **kwargs) -> ModelType:
        try:
            instance = self.model(**kwargs)
            self.session.add(instance)
            await self.session.flush()  # Flush to get ID without committing
            await self.session.refresh(instance)
            return instance
        except Exception:
            await self.session.rollback()
            raise

    async def get(self, id_value) -> Optional[ModelType]:
        # Assuming the primary key column is named 'id'
        result = await self.session.execute(
            select(self.model).filter(self.model.id == id_value)
        )
        return result.scalars().first()

    async def get_all(self) -> List[ModelType]:
        result = await self.session.execute(select(self.model))
        return list(result.scalars().all())

    async def update(self, id_value, **kwargs) -> Optional[ModelType]:
        try:
            instance = await self.get(id_value)
            if instance:
                for key, value in kwargs.items():
                    setattr(instance, key, value)
                await self.session.flush()
                await self.session.refresh(instance)
                return instance
            return None
        except Exception:
            await self.session.rollback()
            raise

    async def delete(self, id_value) -> bool:
        try:
            instance = await self.get(id_value)
            if instance:
                await self.session.delete(instance)
                await self.session.flush()
                return True
            return False
        except Exception:
            await self.session.rollback()
            raise
