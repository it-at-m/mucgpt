import os

from langfuse import Langfuse, get_client
from langfuse.langchain import CallbackHandler
from truststore import inject_into_ssl

from core.logtools import getLogger

logger = getLogger()


class LangfuseProvider:
    _langfuse_callback: CallbackHandler | None = None

    @staticmethod
    def init(version: str) -> Langfuse | None:
        """Initialize Langfuse from the standard LANGFUSE_* environment variables.

        The Langfuse SDK consumes LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY and
        LANGFUSE_HOST directly; no MUCGPT-specific configuration is passed through.
        When the credentials are unset, tracing stays disabled.
        """
        if not (
            os.environ.get("LANGFUSE_PUBLIC_KEY")
            and os.environ.get("LANGFUSE_SECRET_KEY")
        ):
            logger.info(
                "Langfuse is not configured (LANGFUSE_PUBLIC_KEY/LANGFUSE_SECRET_KEY "
                "unset), tracing disabled"
            )
            return None
        try:
            # Langfuse initializes its OTLP exporter in its constructor. Ensure it
            # uses the host certificate store before the exporter is created.
            inject_into_ssl()
            os.environ.setdefault("LANGFUSE_RELEASE", version)
            lf_client = get_client()
            lf_client.auth_check()
            LangfuseProvider._langfuse_callback = CallbackHandler()
            return lf_client
        except Exception as e:
            logger.error(f"Error initializing Langfuse: {e}")
            return None

    @staticmethod
    def get_callback_handler() -> CallbackHandler | None:
        return LangfuseProvider._langfuse_callback
