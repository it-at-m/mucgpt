#!/usr/bin/env python
"""
Test script to verify database connectivity.
This can be run to check if the database is reachable and properly configured.

Environment variables:
    Same as run_migrations.py.
"""

import asyncio
import logging
import os
import sys
import time
import traceback

import asyncpg
from migrations.settings import MigrationSettings
from sqlalchemy.ext.asyncio import create_async_engine


async def test_async_connection():
    """Test database connection using asyncpg directly."""
    logger = logging.getLogger("db_test")

    try:
        settings = MigrationSettings()
    except Exception as e:
        logger.error(f"Failed to load settings: {e}")
        return False

    db = settings.DB
    db_user = db.USER
    db_password = db.PASSWORD.get_secret_value() if db.PASSWORD else None
    db_host = db.HOST
    db_port = db.PORT
    db_name = db.NAME

    # Get timeout setting
    timeout = float(os.getenv("MIGRATION_DB_TIMEOUT", "30"))

    if not all([db_user, db_password, db_host, db_name]):
        logger.error("Missing required database configuration in settings")
        return False

    # Test using asyncpg directly
    try:
        logger.info(
            f"Connecting to {db_host}:{db_port}/{db_name} as {db_user} (timeout: {timeout}s)"
        )
        start_time = time.time()
        conn = await asyncpg.connect(
            user=db_user,
            password=db_password,
            host=db_host,
            port=db_port,
            database=db_name,
            timeout=timeout,
        )

        # Execute a test query
        result = await conn.fetchval("SELECT 1")
        await conn.close()

        elapsed = time.time() - start_time
        logger.info(f"Successfully connected using asyncpg in {elapsed:.2f} seconds")
        logger.info(f"Test query result: {result}")
        return True
    except Exception as e:
        logger.error(f"asyncpg connection failed: {str(e)}")
        logger.error(traceback.format_exc())
        return False


async def test_sqlalchemy_connection():
    """Test database connection using SQLAlchemy."""
    logger = logging.getLogger("db_test")

    try:
        settings = MigrationSettings()
    except Exception:
        return False

    db = settings.DB
    db_user = db.USER
    db_password = db.PASSWORD.get_secret_value() if db.PASSWORD else None
    db_host = db.HOST
    db_port = db.PORT
    db_name = db.NAME

    # Get timeout setting
    timeout = float(os.getenv("MIGRATION_DB_TIMEOUT", "30"))

    if not all([db_user, db_password, db_host, db_name]):
        logger.error("Missing required database configuration in settings")
        return False

    # Construct database URL
    db_url = (
        f"postgresql+asyncpg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    )

    # Test using SQLAlchemy with asyncpg
    try:
        logger.info(
            f"Connecting to {db_host}:{db_port}/{db_name} as {db_user} using SQLAlchemy (timeout: {timeout}s)"
        )
        start_time = time.time()

        engine = create_async_engine(
            db_url, connect_args={"timeout": timeout, "command_timeout": timeout}
        )

        async with engine.connect() as connection:
            result = await connection.execute("SELECT 1")
            row = result.scalar()

        await engine.dispose()

        elapsed = time.time() - start_time
        logger.info(f"Successfully connected using SQLAlchemy in {elapsed:.2f} seconds")
        logger.info(f"Test query result: {row}")
        return True
    except Exception as e:
        logger.error(f"SQLAlchemy connection failed: {str(e)}")
        logger.error(traceback.format_exc())
        return False


async def main():
    # Set up logging
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )
    logger = logging.getLogger("db_test")

    logger.info("Starting database connectivity test")

    # Try both connection methods
    asyncpg_success = await test_async_connection()
    sqlalchemy_success = await test_sqlalchemy_connection()

    if asyncpg_success and sqlalchemy_success:
        logger.info("All database connection tests passed!")
        return 0
    else:
        logger.error("Some database connection tests failed")
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
