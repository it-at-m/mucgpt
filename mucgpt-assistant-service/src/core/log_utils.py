"""Logging utilities for environment variable expansion in YAML configs."""

import os
import re

from yaml import safe_load


def expand_env_vars(text):
    """Expand environment variables in the format ${VAR_NAME:-default}"""

    def replace_var(match):
        var_name = match.group(1)
        default_value = match.group(2) if match.group(2) else ""
        return os.getenv(var_name, default_value)

    # Pattern to match ${VAR_NAME:-default} or ${VAR_NAME}
    pattern = r"\$\{([^}:]+)(?::-([^}]*))?\}"
    return re.sub(pattern, replace_var, text)


def load_log_config(config_path):
    """Load and process log configuration with environment variable expansion"""
    with open(config_path) as file:
        config_text = file.read()

    # Expand environment variables
    expanded_text = expand_env_vars(config_text)

    # Parse the YAML
    return safe_load(expanded_text)
