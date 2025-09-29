#!/usr/bin/env python3
"""
Simple environment variable checker for database configuration.
This script checks environment variables without importing application modules.
"""

import os


def main():
    """Check database-related environment variables."""
    print("🔍 Checking Database Environment Variables")
    print("=" * 50)

    # Database environment variables
    db_env_vars = [
        "MUCGPT_ASSISTANT_DB_HOST",
        "MUCGPT_ASSISTANT_DB_PORT",
        "MUCGPT_ASSISTANT_DB_NAME",
        "MUCGPT_ASSISTANT_DB_USER",
        "MUCGPT_ASSISTANT_DB_PASSWORD",
    ]

    # Logging environment variables
    log_env_vars = [
        "LOG_LEVEL_MUCGPT_ASSISTANT_SERVICE",
        "LOG_LEVEL_ROOT",
    ]

    missing_vars = []

    print("\n📊 Database Configuration:")
    print("-" * 30)
    for var in db_env_vars:
        value = os.getenv(var)
        if var.endswith("PASSWORD"):
            if value:
                print(f"✅ {var}: SET (length: {len(value)} characters)")
                # Check for common password issues
                if len(value) < 8:
                    print(f"   ⚠️  Warning: Password seems short ({len(value)} chars)")
                if value.strip() != value:
                    print("   ⚠️  Warning: Password has leading/trailing whitespace")
            else:
                print(f"❌ {var}: NOT SET")
                missing_vars.append(var)
        else:
            if value:
                print(f"✅ {var}: {value}")
            else:
                print(f"❌ {var}: NOT SET")
                missing_vars.append(var)

    print("\n📝 Logging Configuration:")
    print("-" * 30)
    for var in log_env_vars:
        value = os.getenv(var)
        if value:
            print(f"✅ {var}: {value}")
        else:
            print(f"ℹ️  {var}: NOT SET (will use default: ERROR)")

    print("\n💡 For better debugging, set:")
    print("   export LOG_LEVEL_MUCGPT_ASSISTANT_SERVICE=DEBUG")
    print("   export LOG_LEVEL_ROOT=INFO")

    print("\n" + "=" * 50)

    if missing_vars:
        print(f"❌ Missing variables: {', '.join(missing_vars)}")
        print("\nPlease set these environment variables:")
        for var in missing_vars:
            print(f"   export {var}=<value>")
        return False
    else:
        print("✅ All required environment variables are set!")

        # Additional checks
        host = os.getenv("MUCGPT_ASSISTANT_DB_HOST")
        port = os.getenv("MUCGPT_ASSISTANT_DB_PORT", "5432")
        user = os.getenv("MUCGPT_ASSISTANT_DB_USER")

        print("\n📡 Connection will be attempted to:")
        print(f"   Host: {host}:{port}")
        print(f"   User: {user}")
        print(f"   Database: {os.getenv('MUCGPT_ASSISTANT_DB_NAME')}")

        return True


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
