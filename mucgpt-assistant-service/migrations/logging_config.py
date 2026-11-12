from __future__ import annotations

import logging.config
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "app"))

from core.log_utils import load_log_config


def configure_logging() -> None:
    root = Path(__file__).resolve().parent.parent
    default_path = root / "logconf.yaml"
    if not default_path.exists():
        default_path = root / "app" / "logconf.yaml"
    config_path = Path(
        os.getenv(
            "LOG_CONFIG",
            os.getenv(
                "MUCGPT_ASSISTANT_LOG_CONFIG",
                str(default_path),
            ),
        )
    )
    logging.config.dictConfig(load_log_config(str(config_path)))
