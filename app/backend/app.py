import argparse
import os

import uvicorn

from backend import backend

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("-d", "--development", action="store_true")
    log_config = os.getenv("LOG_CONFIG", "logconf.yaml")
    args = parser.parse_args()

    host = "localhost" if args.development else "0.0.0.0"
    uvicorn.run(backend, host=host, port=8080, log_config=log_config)
