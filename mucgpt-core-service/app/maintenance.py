"""Maintenance entrypoint for scheduled core-service housekeeping.

Runs the image lifecycle job (deletion-outbox drain plus expiry and
conversation-cleanup sweeps) outside the API process, on a schedule owned by
the deployment: a looping container in Compose, a CronJob in Kubernetes. The
job is idempotent and safe to overlap; ``--once`` suits both modes.

The core image flattens ``app/`` into ``/app``, so this module is invoked as
a top-level module next to ``app.py``:

    python -m maintenance              # one pass, exit 0
    python -m maintenance --loop --interval-seconds 300
"""

import argparse
import asyncio

from config.settings import get_settings
from core.image_lifecycle import run_once
from core.image_store import ImageStorageManager, S3ImageStore
from core.logtools import getLogger
from database.image_catalog import ImageCatalogManager

logger = getLogger()


async def _pass(settings) -> None:
    image_settings = settings.image_input
    await ImageStorageManager.init(image_settings)
    if ImageStorageManager._store is None:
        # Disabled image input must not strand already-enqueued deletions.
        if image_settings.s3 is None:
            logger.warning("No image storage configured; skipping lifecycle pass")
            return
        ImageStorageManager._store = S3ImageStore(
            bucket=image_settings.s3.bucket, settings=image_settings.s3
        )
    await run_once(
        ImageCatalogManager.get_session_factory(),
        ImageStorageManager.get_store(),
        image_settings,
    )


async def _loop(interval_seconds: int) -> None:
    while True:
        try:
            await _pass(get_settings())
        except Exception:
            logger.exception("Image lifecycle pass failed")
        await asyncio.sleep(interval_seconds)


async def _main(interval_seconds: int | None) -> None:
    settings = get_settings()
    await ImageCatalogManager.init(settings)
    try:
        if interval_seconds is None:
            await _pass(settings)
        else:
            await _loop(interval_seconds)
    finally:
        await ImageCatalogManager.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--loop",
        action="store_true",
        help="run passes forever instead of exiting after one pass",
    )
    parser.add_argument(
        "--interval-seconds",
        type=int,
        default=300,
        help="seconds between passes in --loop mode (default: 300)",
    )
    args = parser.parse_args()
    try:
        asyncio.run(_main(args.interval_seconds if args.loop else None))
    except Exception:
        logger.exception("Image maintenance failed")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
