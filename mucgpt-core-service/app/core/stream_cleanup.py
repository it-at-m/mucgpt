"""Close nested generation iterators even inside an ASGI cancellation scope."""

from anyio import CancelScope


async def close_stream(stream) -> None:
    """Finish graph teardown before returning lifecycle/database resources."""
    with CancelScope(shield=True):
        await stream.aclose()
