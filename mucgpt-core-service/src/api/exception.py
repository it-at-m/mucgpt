from logging import Logger


def llm_exception_handler(ex: Exception, logger: Logger) -> str:
    """Handles exceptions thrown by the LLM

    Args:
        ex (Exception): the exception
        logger (Logger): the logger

    Returns:
        str: the error message
    """
    try:
        msg = ex.message
        if (
            hasattr(ex, "status_code")
            and hasattr(ex, "code")
            and ex.status_code == 400
            and ex.code == "content_filter"
        ):
            msg = "Es wurde ein Richtlinienverstoß festgestellt und der Chat wird hier beendet"
        elif hasattr(ex, "status_code") and ex.status_code == 429:
            msg = "Momentan liegt eine starke Auslastung vor. Bitte in einigen Sekunden erneut versuchen."
        else:
            msg = f"Ein Fehler ist aufgetreten: {str(ex)}"
        logger.error(
            "Chat error details: %s", vars(ex) if hasattr(ex, "__dict__") else str(ex)
        )
    except Exception as nested_ex:
        msg = "Es ist ein unbekannter Fehler aufgetreten."
        logger.error("Error while handling exception: %s", nested_ex)
    return msg
