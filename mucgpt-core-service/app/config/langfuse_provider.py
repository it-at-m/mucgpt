import os

from langfuse import Langfuse, get_client
from langfuse.langchain import CallbackHandler
from truststore import inject_into_ssl

from config.settings import get_settings
from core.logtools import getLogger
from core.privacy import otel_image_mask, redact_image_payloads

logger = getLogger()

_MEDIA_UPLOAD_ENV = "LANGFUSE_MEDIA_UPLOAD_ENABLED"


def _sdk_image_mask(*, data, **_kwargs):
    """Redact image payloads in structured SDK attributes (legacy mask hook).

    Only active when image media tracing is disabled; it guarantees no image
    bytes reach Langfuse even though hydrated data URIs flow through the
    model call. Managed references and media tokens pass through untouched.
    """
    return redact_image_payloads(data)


class LangfuseProvider:
    _langfuse_callback: CallbackHandler | None = None

    @staticmethod
    def init(version: str) -> Langfuse | None:
        """Initialize Langfuse from the standard LANGFUSE_* environment variables.

        The Langfuse SDK consumes LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY and
        LANGFUSE_HOST directly; no MUCGPT-specific configuration is passed through.
        When the credentials are unset, tracing stays disabled.

        Image media tracing is a separate process-wide opt-in
        (``image_input.langfuse_media_enabled``): the SDK media-upload flag is
        forced from the MUCGPT setting before client construction so an
        inherited environment value can never silently enable (or disable) it.
        When disabled, both SDK masking hooks are configured so no image bytes
        reach Langfuse; when enabled, the LangChain generation callback sees
        hydrated data URIs and the SDK creates native media references (no
        manual double upload, manual spans keep managed-reference projections).
        """
        settings = get_settings()
        media_tracing_enabled = settings.image_input.langfuse_media_enabled
        os.environ[_MEDIA_UPLOAD_ENV] = (
            "true" if media_tracing_enabled else "false"
        )

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
            inject_into_ssl()
            os.environ.setdefault("LANGFUSE_RELEASE", version)
            if media_tracing_enabled:
                lf_client = get_client()
            else:
                lf_client = Langfuse(
                    release=version,
                    mask=_sdk_image_mask,
                    mask_otel_spans=otel_image_mask(),
                )
            lf_client.auth_check()
            LangfuseProvider._langfuse_callback = CallbackHandler()
            return lf_client
        except Exception as e:
            logger.error(f"Error initializing Langfuse: {e}")
            return None

    @staticmethod
    def get_callback_handler() -> CallbackHandler | None:
        return LangfuseProvider._langfuse_callback
