"""Owner-scoped repository for conversations and their messages.

Every read and write is scoped by ``user_id`` so a user can never reach another
user's conversation, regardless of the id supplied in the request path.
"""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from database.models import Conversation, Message

# How many times append_message recomputes the next sequence and retries when a
# concurrent writer wins the race for the same (conversation_id, sequence).
_APPEND_MAX_ATTEMPTS = 5


class ConversationRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(
        self,
        *,
        user_id: str,
        conversation_id: str | None = None,
        title: str | None = None,
        assistant_id: str | None = None,
        model: str | None = None,
        config: dict | None = None,
        messages: Iterable[tuple[str, str]] | None = None,
    ) -> Conversation:
        """Create a conversation, optionally seeding (role, content) messages.

        ``conversation_id`` lets the caller supply the primary key (e.g. a
        client-generated UUID so the same id is used end-to-end). When omitted
        the model's default UUID is generated.
        """
        conversation = Conversation(
            user_id=user_id,
            title=title,
            assistant_id=assistant_id,
            model=model,
            config=config,
            **({"id": conversation_id} if conversation_id else {}),
        )
        self.session.add(conversation)
        await self.session.flush()  # assign id

        for sequence, (role, content) in enumerate(messages or []):
            self.session.add(
                Message(
                    conversation_id=conversation.id,
                    sequence=sequence,
                    role=role,
                    content=content,
                )
            )
        await self.session.flush()
        await self.session.refresh(conversation)
        return conversation

    async def list_for_user(self, user_id: str) -> list[Conversation]:
        """Return the user's conversations, most-recently-updated first."""
        result = await self.session.execute(
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(Conversation.updated_at.desc())
        )
        return list(result.scalars().all())

    async def get_for_user(
        self, conversation_id: str, user_id: str
    ) -> Conversation | None:
        """Return the conversation (with messages) only if owned by user_id."""
        result = await self.session.execute(
            select(Conversation).where(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id,
            )
        )
        # messages are eager-loaded via the relationship's lazy="selectin".
        return result.scalars().first()

    async def update_meta(
        self, conversation_id: str, user_id: str, **fields
    ) -> Conversation | None:
        """Update title/favorite. Returns None if not owned by the user."""
        conversation = await self.get_for_user(conversation_id, user_id)
        if conversation is None:
            return None
        for key, value in fields.items():
            if value is not None and hasattr(conversation, key):
                setattr(conversation, key, value)
        await self.session.flush()
        await self.session.refresh(conversation)
        return conversation

    async def delete(self, conversation_id: str, user_id: str) -> bool:
        """Delete the conversation (cascades to messages). Ownership enforced."""
        conversation = await self.get_for_user(conversation_id, user_id)
        if conversation is None:
            return False
        await self.session.delete(conversation)
        await self.session.flush()
        return True

    async def replace_messages(
        self,
        conversation_id: str,
        user_id: str,
        messages: Iterable[tuple[str, str]],
    ) -> Conversation | None:
        """Replace all stored messages with the given (role, content) sequence.

        Ownership-scoped. Keeps the durable copy in sync with the client's
        authoritative conversation history each turn (so client-side
        rollback/regenerate edits are mirrored without extra endpoints).
        Returns None if the conversation is not owned by the user.
        """
        conversation = await self.get_for_user(conversation_id, user_id)
        if conversation is None:
            return None

        # Clear then flush the deletes first so re-inserting from sequence 0
        # cannot collide with the (conversation_id, sequence) unique constraint.
        conversation.messages[:] = []
        await self.session.flush()

        for sequence, (role, content) in enumerate(messages):
            conversation.messages.append(
                Message(sequence=sequence, role=role, content=content)
            )
        conversation.updated_at = func.now()
        await self.session.flush()
        await self.session.refresh(conversation)
        return conversation

    async def append_message(
        self,
        conversation_id: str,
        user_id: str,
        *,
        role: str,
        content: str,
        tool_calls: list | None = None,
    ) -> Message | None:
        """Append a message with the next sequence number. Ownership enforced.

        Returns None if the conversation is not owned by the user.
        """
        conversation = await self.get_for_user(conversation_id, user_id)
        if conversation is None:
            return None

        # ``max(sequence) + 1`` is computed outside the insert, so two requests
        # appending to the same conversation (now shared across devices/tabs)
        # can pick the same sequence and collide on ``uq_message_sequence``.
        # Insert inside a SAVEPOINT and, on that unique-violation, recompute the
        # next sequence and retry so a normal concurrent append is not lost or
        # turned into a 500. The SAVEPOINT keeps a failed attempt from poisoning
        # the surrounding transaction.
        message: Message | None = None
        for attempt in range(_APPEND_MAX_ATTEMPTS):
            next_sequence = await self.session.scalar(
                select(func.coalesce(func.max(Message.sequence), -1) + 1).where(
                    Message.conversation_id == conversation_id
                )
            )
            message = Message(
                conversation_id=conversation_id,
                sequence=next_sequence,
                role=role,
                content=content,
                tool_calls=tool_calls,
            )
            try:
                # Insert inside a SAVEPOINT; the flush happens when the nested
                # block commits. On a unique-violation only the SAVEPOINT is
                # rolled back, leaving the surrounding transaction usable so we
                # can recompute the sequence and retry. (Adding via the
                # relationship instead would require touching the collection in
                # the failure path, which triggers a reload on a transaction
                # that still needs the SAVEPOINT rollback to settle.)
                async with self.session.begin_nested():
                    self.session.add(message)
                break
            except IntegrityError:
                # Another writer took this sequence; recompute and retry.
                if attempt == _APPEND_MAX_ATTEMPTS - 1:
                    raise
                continue

        # Touch the conversation so updated_at advances (onupdate needs a change).
        conversation.updated_at = func.now()
        await self.session.flush()
        # The message was inserted directly (explicit FK), bypassing the loaded
        # ``messages`` collection; reload it so the in-memory conversation stays
        # consistent with the database for any later read in this session.
        await self.session.refresh(conversation, ["messages"])
        await self.session.refresh(message)
        return message
