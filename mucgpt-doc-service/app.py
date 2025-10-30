import argparse
from logging import Logger
from dotenv import load_dotenv

import uvicorn

from src.core.logtools import getLogger
from src.core.version import get_version


# --- Main function with FastAPI startup logic ---
def main() -> None:
    logger: Logger = getLogger()
    if not load_dotenv():
        raise "Configure .env file"

    parser = argparse.ArgumentParser(description="Run the FastAPI application.")
    parser.add_argument(
        "-d", 
        "--development", 
        action="store_true", 
        help="Run the server in development mode (localhost:8000 with reload)."
    )
    # Add an argument for running the server explicitly, even in production mode
    parser.add_argument(
        "-s", 
        "--server", 
        action="store_true", 
        help="Start the application server (runs in production mode unless -d is used)."
    )
    args: argparse.Namespace = parser.parse_args()

    # Get the package version and log it
    version = get_version() 
    logger.info(f"Starting the application, Version: {version}")

    # --- APPLICATION LOGIC ---
    if args.server or args.development:
        host = "127.0.0.1"  # Default to localhost
        port = 8000         # Default port
        reload = args.development  # Only enable reload in development mode

        if args.development:
            logger.info("Running in **DEVELOPMENT** mode with **AUTO-RELOAD** enabled.")
            # Add development-specific code here, e.g. mock data setup
        else:
            # Production-like settings (e.g., binding to 0.0.0.0 for external access)
            host = "0.0.0.0" 
            logger.info("Running in **PRODUCTION** mode.")
        
        logger.info(f"Starting server at http://{host}:{port}")

        try:
            # Use uvicorn.run to start the FastAPI application
            uvicorn.run(
                "src.api:app",           # <--- THIS IS THE FIX. Use the string path.
                host=host,
                port=port,
                reload=reload,           # Automatically restart on code changes
                log_level="info" if args.development else "warning" # Less verbose in production
            )
        except Exception as e:
            logger.error(f"Failed to start the Uvicorn server: {e}")
            
    else:
        # Default application logic if the server flag is not provided
        print("👋 Application started without server mode.")
        print("Use '-s' or '--server' to run the FastAPI web service.")


if __name__ == "__main__":
    main()