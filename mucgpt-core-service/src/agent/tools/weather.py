import logging


def weather(location: str, logger: logging.Logger) -> str:
    """Call to get the current weather."""
    logger.info("Weather tool called for location: %s", location)
    if location.lower() in ["sf", "san francisco"]:
        result = "It's 60 degrees and foggy."
    else:
        result = "It's 90 degrees and sunny."
    return result
