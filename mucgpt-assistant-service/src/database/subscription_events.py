"""SQLAlchemy event listeners for maintaining subscription counts."""

from sqlalchemy import event, text
from sqlalchemy.orm import attributes

from core.logtools import getLogger

from .database_models import Subscription

logger = getLogger("assistant_repo")


@event.listens_for(Subscription, "after_insert")
def _subscription_after_insert(mapper, connection, target):
    """Increment subscription count when a subscription is created."""
    logger.debug(f"Incrementing subscription count for assistant {target.assistant_id}")
    connection.execute(
        text(
            "UPDATE assistants SET subscriptions_count = subscriptions_count + 1 WHERE id = :assistant_id"
        ),
        {"assistant_id": target.assistant_id},
    )


@event.listens_for(Subscription, "after_update")
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
