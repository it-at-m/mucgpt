from collections.abc import AsyncGenerator
from functools import lru_cache

from fastapi import Depends
from sqlalchemy import URL, exc
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from config.settings import Settings, get_settings
from core.logtools import getLogger

logger = getLogger("mucgpt-assistant-service")


# Database URL creation with settings
def create_database_url(settings: Settings) -> URL:
    """Create database URL from settings using direct parameters (safer for special characters)."""
    db = settings.db
    logger.info("Creating database URL with settings")
    logger.debug(f"db_host: {db.host}")
    logger.debug(f"db_port: {db.port}")
    logger.debug(f"db_name: {db.name}")
    logger.debug(f"db_user: {db.user}")
    logger.debug(f"db_password: {'***MASKED***' if db.password else 'NOT SET'}")

    # Log password length for debugging (without revealing content)
    password_str = db.password.get_secret_value() if db.password else None
    if password_str:
        logger.debug(f"Password length: {len(password_str)} characters")

        # Check for problematic characters that can cause URL parsing issues
        problematic_chars = ["'", "#", "@", "/", "\\", "?", "&", "%", ":", ";"]
        found_chars = [char for char in problematic_chars if char in password_str]
        if found_chars:
            logger.warning(
                f"Password contains URL-problematic characters: {found_chars}"
            )
            logger.warning(
                "Using direct parameter passing to avoid URL encoding issues"
            )
    else:
        logger.error("Database password is not set!")

    # Use direct parameter passing instead of URL string construction
    # This avoids URL encoding issues with special characters
    url = URL.create(
        drivername="postgresql+asyncpg",
        username=db.user,
        password=password_str,
        host=db.host,
        port=db.port,
        database=db.name,
    )

    # Log the URL (without password)
    url_without_password = url.set(
        password="***MASKED***" if password_str else "NOT_SET"
    )
    logger.info(f"Database URL created: {url_without_password}")

    return url


# Singleton engine and session factory
@lru_cache(maxsize=1)
def get_engine_and_factory(database_url: str):
    """Create and cache the SQLAlchemy engine and session factory."""
    logger.info("Creating SQLAlchemy engine and session factory")
    logger.debug(
        f"Database URL (masked): {database_url.replace(database_url.split('://')[1].split('@')[0], '***MASKED***')}"
    )

    try:
        engine = create_async_engine(
            url=database_url,
            # Add connection pool logging
            echo=False,  # Set to True for SQL query logging
            pool_pre_ping=True,  # Verify connections before use
            pool_recycle=3600,  # Recycle connections after 1 hour
        )
        # expire_on_commit=False keeps ORM attributes accessible after commit();
        # otherwise async lazy-loads on expired objects raise MissingGreenlet.
        factory = async_sessionmaker(engine, expire_on_commit=False)
        logger.info("Successfully created engine and session factory")
        return engine, factory
    except Exception as e:
        logger.error(f"Failed to create engine and session factory: {e}")
        raise


# Alternative safer approach using direct connection parameters
# Note: No @lru_cache here because Settings objects are not hashable
_engine_cache = None
_factory_cache = None


def get_engine_and_factory_direct(settings: Settings):
    """Create and cache the SQLAlchemy engine using direct connection parameters (safer for special characters)."""
    global _engine_cache, _factory_cache

    # Simple caching without lru_cache (since Settings is not hashable)
    if _engine_cache is not None and _factory_cache is not None:
        logger.debug("Using cached engine and session factory")
        return _engine_cache, _factory_cache

    logger.info("Creating SQLAlchemy engine with direct connection parameters")
    logger.debug(
        f"Connecting to: {settings.db.host}:{settings.db.port}/{settings.db.name}"
    )
    logger.debug(f"User: {settings.db.user}")

    try:
        # Create engine with connection arguments instead of URL string
        # This avoids URL parsing issues with special characters
        db_password = (
            settings.db.password.get_secret_value() if settings.db.password else None
        )
        connect_args = {
            "host": settings.db.host,
            "port": settings.db.port,
            "database": settings.db.name,
            "user": settings.db.user,
            "password": db_password,
        }
        if settings.db.schema:
            connect_args["server_settings"] = {"search_path": settings.db.schema}
            logger.info(f"Using PostgreSQL schema (search_path): {settings.db.schema}")

        engine = create_async_engine(
            "postgresql+asyncpg://",  # Just the driver, parameters passed separately
            connect_args=connect_args,
            echo=False,  # Set to True for SQL query logging
            pool_pre_ping=True,  # Verify connections before use
            pool_recycle=3600,  # Recycle connections after 1 hour
        )
        # expire_on_commit=False keeps ORM attributes accessible after commit();
        # otherwise async lazy-loads on expired objects raise MissingGreenlet.
        factory = async_sessionmaker(engine, expire_on_commit=False)

        # Cache the results
        _engine_cache = engine
        _factory_cache = factory

        logger.info(
            "Successfully created engine and session factory with direct parameters"
        )
        return engine, factory
    except Exception as e:
        logger.error(
            f"Failed to create engine and session factory with direct parameters: {e}"
        )
        raise


async def get_db_session(
    settings: Settings = Depends(get_settings),
) -> AsyncGenerator[AsyncSession]:
    """Get database session with settings dependency."""
    logger.debug("Starting database session creation")

    try:
        # Use direct parameter approach for better special character handling
        engine, factory = get_engine_and_factory_direct(settings)

        logger.debug("Attempting to create async session")
        async with factory() as session:
            try:
                logger.debug("Database session created successfully")
                yield session
                logger.debug("Database session yielded successfully")
            except exc.SQLAlchemyError as e:
                logger.error(f"SQLAlchemy error in session: {type(e).__name__}: {e}")
                await session.rollback()
                logger.error("Session rolled back due to SQLAlchemy error")
                raise
            except Exception as e:
                logger.error(
                    f"Unexpected error in database session: {type(e).__name__}: {e}"
                )
                await session.rollback()
                logger.error("Session rolled back due to unexpected error")
                raise
            finally:
                logger.debug("Closing database session")
                await session.close()
                logger.debug("Database session closed")

    except exc.SQLAlchemyError as e:
        logger.error(
            f"SQLAlchemy error during session creation: {type(e).__name__}: {e}"
        )

        error_msg = str(e).lower()
        if "password authentication failed" in error_msg:
            logger.error("🔐 Password authentication failed - please check:")
            logger.error("   1. db.user is correct (current: %s)", settings.db.user)
            logger.error("   2. db.password is correct and not expired")
            logger.error(
                "   3. Database server is accessible at %s:%s",
                settings.db.host,
                settings.db.port,
            )
            logger.error("   4. User has proper login permissions")
            logger.error(
                "   5. Database '%s' exists and user has access", settings.db.name
            )
        elif "connection refused" in error_msg:
            logger.error("🔌 Connection refused - please check:")
            logger.error("   1. Database server is running")
            logger.error(
                "   2. Host and port are correct: %s:%s",
                settings.db.host,
                settings.db.port,
            )
            logger.error("   3. Firewall allows connections")
        elif "timeout" in error_msg:
            logger.error("⏱️  Connection timeout - please check:")
            logger.error(
                "   1. Network connectivity to %s:%s",
                settings.db.host,
                settings.db.port,
            )
            logger.error("   2. Database server response time")
        elif "does not exist" in error_msg:
            logger.error("🗄️  Database/table does not exist - please check:")
            logger.error("   1. Database '%s' exists", settings.db.name)
            logger.error("   2. User has access to the database")
        else:
            logger.error(
                "❓ Unrecognized database error - check logs above for details"
            )

        raise
    except Exception as e:
        logger.error(
            f"Unexpected error during session creation: {type(e).__name__}: {e}"
        )
        raise


async def validate_database_connection(settings: Settings) -> bool:
    """Validate database connection with detailed logging."""
    logger.info("Testing database connection...")

    try:
        # Use direct parameter approach for better special character handling
        engine, factory = get_engine_and_factory_direct(settings)

        logger.info("Attempting to connect to database...")
        async with factory() as session:
            # Test with a simple query
            from sqlalchemy import text

            result = await session.execute(text("SELECT 1 as test_value"))
            test_row = result.fetchone()

            if test_row and test_row[0] == 1:
                logger.info("Database connection test successful!")
                return True
            else:
                logger.error("Database connection test failed - unexpected result")
                return False

    except exc.SQLAlchemyError as e:
        logger.error(
            f"Database connection test failed with SQLAlchemy error: {type(e).__name__}: {e}"
        )
        if "password authentication failed" in str(e):
            logger.error("Authentication failed. Check these settings:")
            logger.error(f"- Host: {settings.db.host}:{settings.db.port}")
            logger.error(f"- Database: {settings.db.name}")
            logger.error(f"- User: {settings.db.user}")
            logger.error("- Password: Check if correct and not expired")
        return False
    except Exception as e:
        logger.error(
            f"Database connection test failed with unexpected error: {type(e).__name__}: {e}"
        )
        return False
