from typing import Any

import cloudpickle
from redis.asyncio import Redis

from config.settings import get_redis_settings


class RedisCache:
    _redis_settings = get_redis_settings()
    _redis_client: Redis | None = None

    @staticmethod
    async def init_redis():
        if RedisCache._redis_client is None:
            password = RedisCache._redis_settings.PASSWORD
            username = RedisCache._redis_settings.USERNAME
            client = Redis(
                host=RedisCache._redis_settings.HOST,
                port=RedisCache._redis_settings.PORT,
                username=username.get_secret_value() if username else None,
                password=password.get_secret_value() if password else None,
            )
            try:
                await client.ping()
            except Exception as e:
                await client.close()
                raise e
            else:
                RedisCache._redis_client = client

    @staticmethod
    async def get_redis() -> Redis:
        if RedisCache._redis_client is None:
            raise RuntimeError("Redis client not initialized")
        return RedisCache._redis_client

    @staticmethod
    async def set_object(key: str, obj: Any, ttl: int | None = None) -> None:
        """
        Store an object in the cache.
        :param key: Key to store the object under.
        :param obj: The object to store.
        :param ttl: The time after the object is removed from the cache in s (default: never).
        """
        dump = cloudpickle.dumps(obj)
        redis: Redis = await RedisCache.get_redis()
        await redis.set(name=key, value=dump, ex=ttl)

    @staticmethod
    async def get_object(key: str) -> Any | None:
        """
        Get an object form the cache.
        :param key: The key the object is stored under.
        :return: The decoded object or None if key doesn't exist.
        """
        redis: Redis = await RedisCache.get_redis()
        dump: bytes = await redis.get(name=key)
        if dump is None:
            return None
        obj = cloudpickle.loads(dump)
        return obj
