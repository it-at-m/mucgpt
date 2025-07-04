from os import getenv

import git


class VersionInfo:
    """
    Handle version information from git repository or environment variables.
    """

    @staticmethod
    def get_commit() -> str:
        try:
            repo = git.Repo(search_parent_directories=True)
            commit_hash = repo.commit("HEAD").hexsha
            for tag in repo.tags:
                if tag.commit.hexsha == commit_hash:
                    return tag.name
            return commit_hash[:8]
        except Exception:
            return getenv("MUCGPT_CORE_COMMIT", "unknown")

    @staticmethod
    def get_version() -> str:
        try:
            repo = git.Repo(search_parent_directories=True)
            tags = sorted(repo.tags, key=lambda t: t.commit.committed_datetime)
            latest = tags[-1].name if tags else None
            return latest or getenv("MUCGPT_CORE_VERSION", "unknown")
        except Exception:
            return getenv("MUCGPT_CORE_VERSION", "unknown")
