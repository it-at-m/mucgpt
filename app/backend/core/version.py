from os import getenv

import git


def get_latest_commit() -> str:
    commit = None

    # Try to get the version from the git repository
    try:
        repo = git.Repo(search_parent_directories=True)
        current_commit_hash = repo.commit("HEAD").hexsha

        # Check if the current commit is tagged
        for tag in repo.tags:
            if tag.commit.hexsha == current_commit_hash:
                commit = tag.name
                break

        # If the current commit is not tagged, use the commit hash
        if commit is None:
            commit = f"{current_commit_hash[:8]}"

    # Fallback to the DLF_VERSION environment variable
    except git.exc.InvalidGitRepositoryError:
        commit = getenv("MUCGPT_COMMIT", "null")
    if commit is None:
        commit = getenv("MUCGPT_COMMIT", "null")
    return commit

def get_version() ->str :
    latest_tag = None
    # Öffnen Sie das Repository
    try:
        repo = git.Repo(search_parent_directories=True)
        # Holen Sie sich alle Tags und sortieren Sie sie nach Datum
        tags = sorted(repo.tags, key=lambda t: t.commit.committed_datetime)

        # Der neueste Tag ist der letzte in der sortierten Liste
        latest_tag = tags[-1] if tags else None

        if latest_tag:
            latest_tag = latest_tag.name
    except git.exc.InvalidGitRepositoryError:
        latest_tag = getenv("MUCGPT_VERSION", "null")
    if latest_tag is None:
        latest_tag = getenv("MUCGPT_VERSION", "null")
    return latest_tag
