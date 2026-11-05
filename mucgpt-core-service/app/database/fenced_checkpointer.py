"""Checkpoint operations coordinated with durable conversation retirement."""

from contextlib import asynccontextmanager

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver


class ConversationDeletedError(RuntimeError):
    """The generation's conversation no longer has a live ownership mapping."""


class FencedPostgresSaver(AsyncPostgresSaver):
    """Fence each read/write with the ownership row on the same DB transaction.

    A SHARE lock conflicts with deletion's UPDATE lock. Binding the inner saver
    to this connection prevents a lost lock connection from leaving a writer
    able to save through another pool connection.
    """

    @asynccontextmanager
    async def _live_saver(self, thread_id):
        """Hold a live row's SHARE lock for the connection-bound saver operation."""
        async with self.conn.connection() as connection:
            async with connection.transaction():
                result = await connection.execute(
                    "SELECT conversation_id FROM chats "
                    "WHERE conversation_id = %s AND deleted_at IS NULL FOR SHARE",
                    (thread_id,),
                )
                if await result.fetchone() is None:
                    raise ConversationDeletedError("Conversation has been deleted")
                yield AsyncPostgresSaver(connection, serde=self.serde)

    async def aput(self, config, checkpoint, metadata, new_versions):
        """Commit a checkpoint atomically with its live-row fence, or reject retirement."""
        async with self._live_saver(config["configurable"]["thread_id"]) as saver:
            return await saver.aput(config, checkpoint, metadata, new_versions)

    async def aput_writes(self, config, writes, task_id, task_path=""):
        """Save pending task writes while deletion is excluded by the live-row lock."""
        async with self._live_saver(config["configurable"]["thread_id"]) as saver:
            await saver.aput_writes(config, writes, task_id, task_path)

    async def aget_tuple(self, config):
        """Read a checkpoint while its live ownership mapping is locked against erasure."""
        async with self._live_saver(config["configurable"]["thread_id"]) as saver:
            return await saver.aget_tuple(config)

    async def alist(self, config, *, filter=None, before=None, limit=None):
        """Yield one conversation's history under its fence; unscoped listing is denied."""
        if config is None:
            raise ValueError("Conversation-scoped config is required")
        async with self._live_saver(config["configurable"]["thread_id"]) as saver:
            async for checkpoint in saver.alist(
                config, filter=filter, before=before, limit=limit
            ):
                yield checkpoint

    async def adelete_thread(self, thread_id):
        """Reject unfenced deletion; erasure must atomically retire the ownership row."""
        # Erasure must also retire the ownership row atomically. Never expose
        # the base saver's uncoordinated deletion through this application API.
        raise RuntimeError("Use PersistanceHelpers.erase_conversation")
