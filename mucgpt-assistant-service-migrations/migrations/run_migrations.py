#!/usr/bin/env python
"""
Standalone script to run database migrations.
Can be executed independently of the main application.
"""

import argparse
import logging
import os
import sys

from alembic import command
from alembic.config import Config


def setup_logging():
    """Set up logging for the migration script."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[logging.StreamHandler()],
    )
    return logging.getLogger("migrations")


def get_database_url():
    """Get database URL from environment variables."""
    # First try to get from DATABASE_URL environment variable
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        return database_url

    # If not available, build from individual environment variables
    db_user = os.getenv("MUCGPT_ASSISTANT_DB_USER")
    db_password = os.getenv("MUCGPT_ASSISTANT_DB_PASSWORD")
    db_host = os.getenv("MUCGPT_ASSISTANT_DB_HOST")
    db_port = os.getenv("MUCGPT_ASSISTANT_DB_PORT", "5432")
    db_name = os.getenv("MUCGPT_ASSISTANT_DB_NAME")

    if not all([db_user, db_password, db_host, db_name]):
        print("Error: Database environment variables not set")
        sys.exit(1)

    return (
        f"postgresql+psycopg2://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    )


def run_migrations(revision="head"):
    """Run migrations to specified revision."""
    logger = setup_logging()

    # Get script directory
    dir_path = os.path.dirname(os.path.realpath(__file__))

    # Create Alembic config
    alembic_cfg = Config()
    alembic_cfg.set_main_option("script_location", dir_path)

    # Set SQLAlchemy URL
    db_url = get_database_url()
    # Log only non-sensitive database details
    db_host = os.getenv("MUCGPT_ASSISTANT_DB_HOST")
    db_port = os.getenv("MUCGPT_ASSISTANT_DB_PORT", "5432")
    db_name = os.getenv("MUCGPT_ASSISTANT_DB_NAME")
    logger.info(f"Using database host: {db_host}, port: {db_port}, name: {db_name}")
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    # Run the migration
    try:
        command.upgrade(alembic_cfg, revision)
        logger.info(f"Successfully migrated database to {revision}")
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run database migrations")
    parser.add_argument(
        "--revision", default="head", help="Revision to upgrade to (default: head)"
    )
    args = parser.parse_args()

    run_migrations(args.revision)
