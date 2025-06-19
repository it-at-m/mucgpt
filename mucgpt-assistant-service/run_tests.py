#!/usr/bin/env python3
"""Test runner script for the repository tests."""

import subprocess
import sys
from pathlib import Path
from typing import List


def run_command(cmd: List[str], description: str) -> bool:
    """Run a command and return success status."""
    print(f"\n{'=' * 60}")
    print(f"Running: {description}")
    print(f"Command: {' '.join(cmd)}")
    print(f"{'=' * 60}")

    try:
        subprocess.run(cmd, check=True, cwd=Path(__file__).parent)
        print(f"✅ {description} completed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed with exit code {e.returncode}")
        return False


def main():
    """Main function to run various test configurations."""
    print("🧪 Repository Test Runner")
    print("This script runs the repository unit tests in various configurations.")

    # Define test commands
    test_commands = [
        (["uv", "run", "pytest", "tests/", "-v"], "All Tests (Verbose)"),
        (
            ["uv", "run", "pytest", "tests/database/test_repo.py", "-v"],
            "Base Repository Tests Only",
        ),
        (
            ["uv", "run", "pytest", "tests/database/test_assistant_repo.py", "-v"],
            "Assistant Repository Tests Only",
        ),
        (
            [
                "uv",
                "run",
                "pytest",
                "tests/",
                "--cov=src/database",
                "--cov-report=term-missing",
            ],
            "All Tests with Coverage Report",
        ),
    ]

    # Ask user which test to run
    print("\nAvailable test configurations:")
    for i, (_, description) in enumerate(test_commands, 1):
        print(f"{i}. {description}")
    print("0. Run all configurations")

    try:
        choice = input("\nEnter your choice (0-4): ").strip()

        if choice == "0":
            # Run all configurations
            all_passed = True
            for cmd, desc in test_commands:
                if not run_command(cmd, desc):
                    all_passed = False

            if all_passed:
                print("\n🎉 All test configurations passed!")
                return 0
            else:
                print("\n💥 Some test configurations failed!")
                return 1

        elif choice in ["1", "2", "3", "4"]:
            cmd, desc = test_commands[int(choice) - 1]
            return 0 if run_command(cmd, desc) else 1
        else:
            print("Invalid choice. Please enter 0-4.")
            return 1

    except KeyboardInterrupt:
        print("\n\n👋 Test runner interrupted by user.")
        return 1
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
