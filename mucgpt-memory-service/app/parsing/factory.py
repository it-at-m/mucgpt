from config.settings import ParserBackendType, get_settings
from core.logtools import getLogger
from parsing.base import ParserBackend

logger = getLogger()


def get_parser() -> ParserBackend:
    """Instantiate and return the configured parser backend.

    The backend is selected via the ``PARSER_BACKEND`` setting.
    """
    settings = get_settings()
    backend = settings.PARSER_BACKEND

    if backend == ParserBackendType.KREUZBERG:
        from parsing.kreuzberg import KreuzbergBackend

        logger.info("Using KreuzbergBackend for parsing")
        return KreuzbergBackend()

    raise ValueError(f"Unknown parser backend: '{backend}'")
