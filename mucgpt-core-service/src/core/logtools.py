import json
import logging
import logging.config
import threading
import traceback
from datetime import datetime

from config.settings import get_settings
from core.log_utils import load_log_config

# Thread-safe configuration lock
_config_lock = threading.Lock()
_configured = False


def getLogger(name: str = "mucgpt-core") -> logging.Logger:
    """Configures logging and returns a logger with the specified name.

    Parameters:
    name (str): The name of the logger.

    Returns:
    logging.Logger: The logger with the specified name.
    """
    global _configured

    # Use double-checked locking pattern for thread safety
    if not _configured:
        with _config_lock:
            if not _configured:
                try:
                    settings = get_settings()
                    log_config_path = settings.LOG_CONFIG
                    log_config = load_log_config(log_config_path)
                    logging.config.dictConfig(log_config)
                    _configured = True
                except Exception as e:
                    # Fallback to basic configuration if loading fails
                    logging.basicConfig(
                        level=logging.INFO,
                        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                    )
                    _configured = True
                    # Log the configuration error
                    logging.getLogger(__name__).error(f"Failed to load log config: {e}")

    return logging.getLogger(name)


class JsonFormatter(logging.Formatter):
    """A custom JSON formatter for logging."""

    def format(self, record: logging.LogRecord) -> str:
        """Formats the log record as a JSON string.

        Parameters:
        record (logging.LogRecord): The log record to format.

        Returns:
        str: The log record as a JSON string.
        """
        log_data = {
            "time": datetime.fromtimestamp(record.created).strftime(
                "%Y-%m-%d %H:%M:%S"
            ),
            "level": record.levelname,
            "id": getattr(record, "correlation_id", None),
            "message": record.getMessage(),
            "name": record.name,
        }

        # Add exception information if present
        if record.exc_info:
            log_data["exception"] = str(record.exc_info[1])
            log_data["traceback"] = "".join(
                traceback.format_exception(*record.exc_info)
            )

        # Add extra fields (all custom attributes merged via logging's `extra=`
        reserved = {
            "name",
            "msg",
            "args",
            "levelname",
            "levelno",
            "pathname",
            "filename",
            "module",
            "exc_info",
            "exc_text",
            "stack_info",
            "lineno",
            "funcName",
            "created",
            "msecs",
            "relativeCreated",
            "thread",
            "threadName",
            "processName",
            "process",
        }
        for k, v in record.__dict__.items():
            if k not in log_data and k not in reserved:
                log_data[k] = v

        return json.dumps(log_data, default=str)
