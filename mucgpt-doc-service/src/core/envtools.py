from os import getenv


class MissingEnvironmentVariableException(Exception):
    """Raised when a mandatory environment variable is not set."""

    def __init__(self, env_var: str):
        self.env_var: str = env_var
        self.message: str = f"Environment variable '{env_var}' is not set."
        super().__init__(self.message)


def getenv_with_exception(key: str) -> str:
    """Get an environment variable or raise an exception if it is not set.

    Args:
        key (str): The name of the environment variable

    Raises:
        MissingEnvironmentVariableException: If the environment variable is not set

    Returns:
        str: The value of the environment variable
    """
    value: str | None = getenv(key=key)
    if value is None:
        raise MissingEnvironmentVariableException(env_var=key)
    return value
