import argparse  # noqa
import os  # noqa
import uvicorn
import logging

from core.log_utils import load_log_config
from core.logtools import getLogger
from truststore import inject_into_ssl

if os.getenv("TRUSTSTORE_DISABLE", "0") not in {"1", "true", "TRUE", "yes"}:
    try:
        inject_into_ssl()
    except Exception as e:
        logging.getLogger(__name__).warning("truststore injection failed: %s", e)

from dotenv import find_dotenv, load_dotenv  # noqa

load_dotenv(find_dotenv(raise_error_if_not_found=False))  # noqa
logger = getLogger()

from api import api

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("-d", "--development", action="store_true")
    log_config_path = os.getenv("LOG_CONFIG", "logconf.yaml")
    args = parser.parse_args()

    # Load and process the log configuration
    log_config = load_log_config(log_config_path)

    host = "localhost" if args.development else "0.0.0.0"
    uvicorn.run(api, host=host, port=8080, log_config=log_config)
