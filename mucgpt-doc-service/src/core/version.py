from logging import Logger

from yaml import safe_load

from src.core.envtools import getenv_with_exception
from src.core.logtools import getLogger

logger: Logger = getLogger()


def get_version() -> str:
    if version := _get_git_version():
        logger.info(f"Version {version} (from git)")
        return version
    elif version := _get_file_version():
        logger.info(f"Version {version} (from .version.yaml)")
        return version
    elif version := getenv_with_exception("APP_VERSION"):
        logger.info(f"Version {version} (from APP_VERSION env var)")
        return version
    else:
        logger.warning("No version found")
        return "Unknown Version"


def _get_git_version() -> str | None:
    version: str | None = None

    # Try to get the version from the git repository
    try:
        from git import Repo

        repo = Repo(search_parent_directories=True)
        current_commit_hash: str = repo.commit("HEAD").hexsha

        # Check if the current commit is tagged
        for tag in repo.tags:
            if tag.commit.hexsha == current_commit_hash:
                return tag.name

        # If the current commit is not tagged, use the commit hash stub
        if version is None:
            return current_commit_hash[:8]

    # Fallback to None if no git repository is found
    # This is a blank catch-all because there could also be errors for not found git executables etc.
    except Exception as e:
        logger.exception("Failed to get version from git", exc_info=e)
        return None


def _get_file_version() -> str | None:
    VERSION_FILE: str = ".version.yaml"
    try:
        with open(VERSION_FILE, "r", encoding="utf-8") as file:
            version_dict: dict = safe_load(file)
    except FileNotFoundError:
        return None

    if version := version_dict.get("commit_tag"):
        return str(version)
    elif version := version_dict.get("commit_short_sha"):
        return str(version)
    else:
        return None
