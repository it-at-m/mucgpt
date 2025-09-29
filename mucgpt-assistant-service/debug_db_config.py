#!/usr/bin/env python3
"""
Database configuration debug script with detailed logging.
Run this script to test database connectivity and diagnose authentication issues.
"""

import asyncio
import os
import sys

from config.settings import get_settings
from core.logtools import getLogger
from database.session import test_database_connection

logger = getLogger("db-config-debug")


def check_environment_variables():
    """Check and log environment variables."""
    logger.info("=== Environment Variables Check ===")

    env_vars = [
        "MUCGPT_ASSISTANT_DB_HOST",
        "MUCGPT_ASSISTANT_DB_PORT",
        "MUCGPT_ASSISTANT_DB_NAME",
        "MUCGPT_ASSISTANT_DB_USER",
        "MUCGPT_ASSISTANT_DB_PASSWORD",
    ]

    missing_vars = []
    for var in env_vars:
        value = os.getenv(var)
        if var.endswith("PASSWORD"):
            if value:
                logger.info(f"✅ {var}: SET (length: {len(value)})")
            else:
                logger.error(f"❌ {var}: NOT SET")
                missing_vars.append(var)
        else:
            if value:
                logger.info(f"✅ {var}: {value}")
            else:
                logger.error(f"❌ {var}: NOT SET")
                missing_vars.append(var)

    return missing_vars


async def main():
    """Main debug function."""
    logger.info("🔍 Starting database configuration debug...")

    try:
        # Check environment variables first
        missing_vars = check_environment_variables()

        if missing_vars:
            logger.error(f"\n❌ Missing required environment variables: {missing_vars}")
            logger.error("Please set these variables before running the application.")
            return False

        # Load settings
        logger.info("\n=== Settings Loading ===")
        settings = get_settings()

        logger.info("✅ Settings loaded successfully:")
        logger.info(f"   DB_HOST: {settings.DB_HOST}")
        logger.info(f"   DB_PORT: {settings.DB_PORT}")
        logger.info(f"   DB_NAME: {settings.DB_NAME}")
        logger.info(f"   DB_USER: {settings.DB_USER}")
        logger.info(f"   DB_PASSWORD: {'SET' if settings.DB_PASSWORD else 'NOT SET'}")

        # Test the connection
        logger.info("\n=== Database Connection Test ===")
        success = await test_database_connection(settings)

        if success:
            logger.info("\n✅ Database connection test PASSED!")
            return True
        else:
            logger.error("\n❌ Database connection test FAILED!")
            logger.error("\nTroubleshooting tips:")
            logger.error("1. Verify the database server is running")
            logger.error("2. Check if the user 'mucgpt-database-admin' exists")
            logger.error("3. Verify the password is correct")
            logger.error("4. Check if the user has login permissions")
            logger.error("5. Verify network connectivity to the database host")
            return False

    except Exception as e:
        logger.error(f"❌ Debug script failed: {type(e).__name__}: {e}")
        import traceback

        logger.error(f"Traceback: {traceback.format_exc()}")
        return False


if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)
