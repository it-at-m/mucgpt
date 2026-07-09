from config.settings import ParserBackendType, get_settings
from core.logtools import getLogger
from parsing.base import ParserBackend
from parsing.xberg import XbergBackend

logger = getLogger()


def get_parser() -> ParserBackend | None:
    """Instantiate and return the configured parser backend, or ``None`` when
    document processing is disabled (``PARSER_BACKEND=none``).

    The backend is selected via the ``PARSER_BACKEND`` setting.
    """
    settings = get_settings()
    backend = settings.PARSER_BACKEND

    if backend == ParserBackendType.NONE:
        logger.info("Document processing disabled (PARSER_BACKEND=none)")
        return None

    if backend == ParserBackendType.XBERG:
        logger.info("Using XbergBackend for parsing")
        return XbergBackend()

    raise ValueError(f"Unknown parser backend: '{backend}'")
