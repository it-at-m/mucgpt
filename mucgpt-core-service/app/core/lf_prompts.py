from pathlib import Path

from langfuse import Langfuse

from core.logtools import getLogger

logger = getLogger()

PROMPT_POOL_DIR = Path(__file__).resolve().parents[1] / "agent/prompt_pool"


class PromptPool:
    """Resolves default (non-assistant) prompts, optionally backed by Langfuse.

    Local Markdown files under agent/prompt_pool/ are always loaded as the
    fallback/default text. When a Langfuse client is configured, `init()`
    primes Langfuse's own prompt cache once at startup, and `get_prompt()`
    re-consults that cache on every call - which returns the last-known-good
    version if a live fetch fails, and the local default if nothing has ever
    been cached for that name.
    """

    _defaults: dict[str, str] = {
        path.stem: path.read_text(encoding="utf-8")
        for path in PROMPT_POOL_DIR.rglob("*.md")
    }
    _lf_client: Langfuse | None = None

    @classmethod
    def init(cls, lf_client: Langfuse | None) -> None:
        cls._lf_client = lf_client
        if not lf_client:
            return
        for name in cls._defaults:
            try:
                lf_client.get_prompt(name, max_retries=1, fetch_timeout_seconds=2)
            except Exception as e:
                logger.warning("Could not prime Langfuse prompt '%s': %s", name, e)

    @classmethod
    def get_prompt(cls, name: str) -> str:
        default = cls._defaults[name]
        if not cls._lf_client:
            return default
        try:
            return cls._lf_client.get_prompt(
                name, fallback=default, max_retries=1, fetch_timeout_seconds=2
            ).prompt
        except Exception as e:
            logger.warning("Falling back to local prompt for '%s': %s", name, e)
            return default
