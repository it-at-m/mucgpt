#!/usr/bin/env python
"""
Standalone script to run database migrations.
Can be executed independently of the main application.
Configuration is controlled through environment variables.

Environment variables:
    MIGRATION_REVISION: Target revision to migrate to (default: head)
    MIGRATION_LOG_LEVEL: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    MIGRATION_CHECK_ONLY: If set to 'true', only check configuration without running migrations
    MIGRATION_SHOW_SQL: If set to 'true', show SQL statements during migration
    MIGRATION_DB_TIMEOUT: Database connection timeout in seconds (default: 30)
    MIGRATION_DB_RETRIES: Number of connection retry attempts (default: 1)
    MIGRATION_DB_RETRY_DELAY: Delay between retry attempts in seconds (default: 5)
"""

import logging
import os
import sys
import time
import traceback

# Add root directory to path to allow imports from migrations package
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlalchemy
from alembic import command
from alembic.config import Config
from migrations.settings import get_db_url


def setup_logging():
    """Set up logging for the migration script."""
    # Get log level from environment or default to INFO
    log_level_name = os.getenv("MIGRATION_LOG_LEVEL", "INFO")
    log_level = getattr(logging, log_level_name.upper(), logging.INFO)

    logging.basicConfig(
        level=log_level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler()],
    )

    # Set SQLAlchemy and Alembic logging
    logging.getLogger("sqlalchemy").setLevel(log_level)
    logging.getLogger("alembic").setLevel(log_level)

    logger = logging.getLogger("migrations")
    logger.info(f"Logging initialized at level: {logging.getLevelName(log_level)}")
    return logger


def get_database_url():
    """Get database URL from settings."""
    logger = logging.getLogger("migrations")
    try:
        url = get_db_url()
        # Log only non-sensitive connection target information for debugging.
        try:
            parsed_url = sqlalchemy.engine.make_url(url)
            if parsed_url.host:
                if parsed_url.port:
                    logger.info(
                        "Using database at %s:%s",
                        parsed_url.host,
                        parsed_url.port,
                    )
                else:
                    logger.info("Using database at %s", parsed_url.host)
        except Exception:
            # If URL parsing fails, avoid logging the raw URL to prevent leaking secrets.
            logger.debug(
                "Database URL could not be parsed for logging host information."
            )
        return url
    except Exception as e:
        logger.error(f"Failed to get database configuration: {e}")
        sys.exit(1)


def run_migrations(revision="head"):
    """Run migrations to specified revision."""
    logger = setup_logging()

    # Get connection timeout and retry settings
    db_timeout = int(os.getenv("MIGRATION_DB_TIMEOUT", "30"))
    db_retries = int(os.getenv("MIGRATION_DB_RETRIES", "1"))
    db_retry_delay = int(os.getenv("MIGRATION_DB_RETRY_DELAY", "5"))

    logger.info(f"Database connection timeout: {db_timeout}s")
    logger.info(f"Connection retry attempts: {db_retries}")

    # Get script directory
    dir_path = os.path.dirname(os.path.realpath(__file__))

    # Create Alembic config
    alembic_cfg = Config()
    alembic_cfg.set_main_option("script_location", dir_path)

    # Set SQLAlchemy URL (env.py will override with async URL for engine)
    db_url = get_database_url()
    # Add timeout parameter to the connection URL if using PostgreSQL
    if db_url.startswith("postgresql") and "connect_timeout" not in db_url:
        if "?" in db_url:
            db_url += f"&connect_timeout={db_timeout}"
        else:
            db_url += f"?connect_timeout={db_timeout}"

    # Log only non-sensitive database details
    db_host = os.getenv("MUCGPT_ASSISTANT_DB__HOST")
    db_port = os.getenv("MUCGPT_ASSISTANT_DB__PORT", "5432")
    db_name = os.getenv("MUCGPT_ASSISTANT_DB__NAME")
    logger.info(f"Using database host: {db_host}, port: {db_port}, name: {db_name}")
    logger.info(f"Using alembic script location: {dir_path}")
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    # Note: connect_args are configured in migrations/env.py for the async engine

    # Run the migration with retries
    attempt = 0
    last_error = None

    while attempt < db_retries:
        attempt += 1
        try:
            logger.info(
                f"Starting migration to revision: {revision} (attempt {attempt}/{db_retries})"
            )
            command.upgrade(alembic_cfg, revision)
            logger.info(f"Successfully migrated database to {revision}")
            return  # Success, exit the retry loop
        except Exception as e:
            last_error = e
            logger.error(f"Migration attempt {attempt} failed: {str(e)}")
            logger.error(f"Traceback for attempt {attempt}:")
            logger.error(traceback.format_exc())  # Log traceback for each attempt
            if attempt < db_retries:
                logger.info(f"Waiting {db_retry_delay} seconds before retrying...")
                time.sleep(db_retry_delay)
            else:
                logger.error(
                    "All migration attempts failed."
                )  # If we get here, all attempts failed
    logger.error("Migration failed after all retry attempts")
    logger.error("Detailed error information:")
    logger.error(traceback.format_exc())  # Log the current exception information
    logger.error(f"Error: {str(last_error)}")  # Log alembic configuration for debugging
    try:
        # Log all config options available in alembic
        config_options = alembic_cfg.get_main_option_names()
        logger.debug(f"Alembic config options: {config_options}")

        # Check if sqlalchemy.url is properly set
        db_url_configured = alembic_cfg.get_main_option("sqlalchemy.url")
        if db_url_configured:
            logger.info("Database URL is properly configured in Alembic")
        else:
            logger.warning("Database URL appears to be missing from Alembic config")

        # Check if script_location is properly set
        script_loc = alembic_cfg.get_main_option("script_location")
        logger.info(f"Alembic script_location: {script_loc}")
        # Check if alembic paths exist
        if script_loc:
            if os.path.exists(script_loc):
                logger.info(f"Script location directory exists: {script_loc}")
                # List migration files for debugging
                versions_path = os.path.join(script_loc, "versions")
                if os.path.exists(versions_path):
                    migration_files = os.listdir(versions_path)
                    logger.info(
                        f"Found {len(migration_files)} migration files in {versions_path}"
                    )
                    logger.debug(f"Migration files: {migration_files}")
                else:
                    logger.warning(
                        f"Versions directory does not exist: {versions_path}"
                    )
            else:
                logger.error(f"Script location directory does not exist: {script_loc}")
    except Exception as config_error:
        logger.warning(f"Could not log alembic config: {str(config_error)}")
    sys.exit(1)


def validate_database_config():
    """Validate database configuration and check for common issues."""
    logger = logging.getLogger("migrations")
    issues_found = False

    # Check database URL format
    db_url = get_database_url()
    if not db_url.startswith("postgresql+asyncpg://"):
        logger.warning(
            "Database URL does not use the expected postgresql+asyncpg scheme."
        )
        issues_found = True

    # Check if required environment variables are present but empty
    for env_var in [
        "MUCGPT_ASSISTANT_DB__USER",
        "MUCGPT_ASSISTANT_DB__PASSWORD",
        "MUCGPT_ASSISTANT_DB__HOST",
        "MUCGPT_ASSISTANT_DB__NAME",
    ]:
        if os.getenv(env_var) == "":
            logger.error(f"Environment variable {env_var} is set but empty!")
            issues_found = True

    # Check database host for common misconfigurations
    db_host = os.getenv("MUCGPT_ASSISTANT_DB__HOST", "")
    if db_host in ["localhost", "127.0.0.1"] and os.getenv("DATABASE_URL") is None:
        logger.info(
            "Using localhost database. This might cause issues if running in Docker."
        )

    # Check if port is a valid integer
    db_port = os.getenv("MUCGPT_ASSISTANT_DB__PORT", "5432")
    try:
        int(db_port)
    except ValueError:
        logger.error(f"Database port is not a valid integer: {db_port}")
        issues_found = True

    return not issues_found


if __name__ == "__main__":
    # Get configuration from environment variables
    revision = os.getenv("MIGRATION_REVISION", "head")
    check_only = os.getenv("MIGRATION_CHECK_ONLY", "").lower() in ["true", "1", "yes"]
    show_sql = os.getenv("MIGRATION_SHOW_SQL", "").lower() in ["true", "1", "yes"]

    # Configure SQL logging if requested
    if show_sql:
        # This will make SQLAlchemy log all SQL statements
        logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)

    # Initialize logging
    logger = setup_logging()

    # Log the configuration
    logger.info(f"Migration revision target: {revision}")
    logger.info(f"Check only mode: {check_only}")
    logger.info(f"Show SQL: {show_sql}")

    # Check if it's a check-only run
    if check_only:
        try:
            # Validate database configuration
            logger.info("Checking database configuration...")
            if not validate_database_config():
                logger.warning(
                    "Database configuration has issues that might cause problems"
                )
            else:
                logger.info("Database configuration looks valid")

            db_url = get_database_url()
            logger.info("Database URL configuration check passed")

            # Import sqlalchemy to test connection
            try:
                logger.info(f"SQLAlchemy version: {sqlalchemy.__version__}")

                # Try to connect to the database
                logger.info("Testing database connection...")
                engine = sqlalchemy.create_engine(db_url)
                connection = engine.connect()
                # Check if we can actually query the database
                result = connection.execute("SELECT 1").fetchone()
                if result and result[0] == 1:
                    logger.info("Database connection and query successful!")
                else:
                    logger.warning(
                        "Connected to database but test query returned unexpected result"
                    )
                connection.close()
            except ImportError:
                logger.error(
                    "SQLAlchemy not installed. Cannot test database connection."
                )
            except Exception as e:
                logger.error(f"Database connection test failed: {str(e)}")
                import traceback

                logger.error(traceback.format_exc())
                sys.exit(1)
        except Exception as e:
            logger.error(f"Configuration check failed: {str(e)}")
            logger.error(traceback.format_exc())
            sys.exit(1)
    else:
        # Run the actual migrations
        run_migrations(revision)
