from pathlib import Path

from langfuse import Langfuse

from config.settings import PromptPoolConfig
from core.logtools import getLogger

logger = getLogger()

PROMPT_POOL_DIR = Path(__file__).resolve().parents[1] / "agent/prompt_pool"


class PromptPool:
    """Load configured prompts from Langfuse with local Markdown fallbacks."""

    _defaults: dict[str, str] = {
        path.stem: path.read_text(encoding="utf-8")
        for path in PROMPT_POOL_DIR.rglob("*.md")
    }
    _lf_client: Langfuse | None = None
    _prompts: dict[str, tuple[str, str]] = {}
    _folder_prompts: dict[tuple[str, str], tuple[str, str]] = {}

    @classmethod
    def init(cls, lf_client: Langfuse | None, config: PromptPoolConfig) -> None:
        cls._lf_client = lf_client
        cls._prompts = {
            prompt.name: (f"{folder.name.strip('/')}/{prompt.name}", prompt.label)
            for folder in config.FOLDERS
            for prompt in folder.prompts
        }
        cls._folder_prompts = {
            (folder.name.strip("/"), prompt.name): (
                f"{folder.name.strip('/')}/{prompt.name}",
                prompt.label,
            )
            for folder in config.FOLDERS
            for prompt in folder.prompts
        }

    @classmethod
    def get_prompt(cls, name: str, folder_name: str | None = None) -> str:
        normalized_folder = folder_name.strip("/") if folder_name else None
        local_path = (
            PROMPT_POOL_DIR / normalized_folder / f"{name}.md"
            if normalized_folder
            else None
        )
        local_prompt = (
            local_path.read_text(encoding="utf-8")
            if local_path is not None and local_path.is_file()
            else cls._defaults.get(name)
        )
        if cls._lf_client is None:
            if local_prompt is None:
                raise KeyError(name)
            return local_prompt

        prompt_config = (
            cls._folder_prompts.get((normalized_folder, name))
            if normalized_folder
            else cls._prompts.get(name)
        )
        if prompt_config is None:
            if local_prompt is None:
                raise KeyError(name)
            return local_prompt

        full_name, label = prompt_config
        try:
            return cls._lf_client.get_prompt(
                full_name,
                label=label,
                fallback=local_prompt,
            ).prompt
        except Exception as exc:
            if local_prompt is None:
                raise
            logger.warning(
                "Falling back to local prompt for '%s': %s",
                name,
                exc,
            )
            return local_prompt
