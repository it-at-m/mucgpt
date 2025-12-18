from langfuse import Langfuse
from langfuse.langchain import CallbackHandler

from config.settings import LangfuseSettings
from core.logtools import getLogger

logger = getLogger()

class LangfuseProvider:
    _langfuse_callback: CallbackHandler | None = None

    @staticmethod
    def init(version: str, langfuse_cfg: LangfuseSettings):
        if langfuse_cfg is not None:
            if (
                    langfuse_cfg.HOST
                    and langfuse_cfg.SECRET_KEY
                    and langfuse_cfg.PUBLIC_KEY
            ):
                try:
                    langfuse = Langfuse(
                        public_key=langfuse_cfg.PUBLIC_KEY,
                        host=langfuse_cfg.HOST,
                        secret_key=langfuse_cfg.SECRET_KEY,
                        release=version,
                    )
                    langfuse.auth_check()
                    LangfuseProvider._langfuse_callback = CallbackHandler(
                        public_key=langfuse_cfg.PUBLIC_KEY,
                    )
                except Exception as e:
                    logger.error(f"Error initializing Langfuse: {e}")

    @staticmethod
    def get_callback_handler() -> CallbackHandler | None:
        return LangfuseProvider._langfuse_callback
