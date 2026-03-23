"""SQLAlchemy event listeners for maintaining subscription counts."""

from sqlalchemy import text
from sqlalchemy.orm import attributes

from core.logtools import getLogger

# Import is deferred to avoid circular import: database.__init__ imports this module
# while database_models may not be fully initialized yet.

logger = getLogger("assistant_repo")


def _subscription_after_insert(mapper, connection, target):
    """Increment subscription count when a subscription is created."""
    logger.debug(f"Incrementing subscription count for assistant {target.assistant_id}")
    connection.execute(
        text(
            "UPDATE assistants SET subscriptions_count = subscriptions_count + 1 WHERE id = :assistant_id"
        ),
        {"assistant_id": target.assistant_id},
    )


def _subscription_after_update(mapper, connection, target):
    """Handle subscription count when assistant_id changes on a subscription."""
    hist = attributes.get_history(target, "assistant_id")
    if not hist.has_changes():
        return

    old_id = hist.deleted[0] if hist.deleted else None
    new_id = hist.added[0] if hist.added else None

    if old_id and old_id != new_id:
        logger.debug(f"Decrementing subscription count for old assistant {old_id}")
        connection.execute(
            text(
                "UPDATE assistants SET subscriptions_count = subscriptions_count - 1 WHERE id = :assistant_id"
            ),
            {"assistant_id": old_id},
        )

    if new_id and old_id != new_id:
        logger.debug(f"Incrementing subscription count for new assistant {new_id}")
        connection.execute(
            text(
                "UPDATE assistants SET subscriptions_count = subscriptions_count + 1 WHERE id = :assistant_id"
            ),
            {"assistant_id": new_id},
        )


def _subscription_after_delete(mapper, connection, target):
    """Decrement subscription count when a subscription is deleted."""
    logger.debug(f"Decrementing subscription count for assistant {target.assistant_id}")
    connection.execute(
        text(
            "UPDATE assistants SET subscriptions_count = subscriptions_count - 1 WHERE id = :assistant_id"
        ),
        {"assistant_id": target.assistant_id},
    )


# Event listeners disabled - manual counter updates in assistant_repo.py
# event.listen(Subscription, "after_insert", _subscription_after_insert)
# event.listen(Subscription, "after_update", _subscription_after_update)
# event.listen(Subscription, "after_delete", _subscription_after_delete)
