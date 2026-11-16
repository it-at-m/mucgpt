#!/usr/bin/env python3
"""Check third-party licenses against the [tool.licensecheck] policy.

Shipped dependencies fail on unapproved/unknown licenses; dev-only
dependencies and weak copyleft only warn. Exit code 1 on violations.

Usage:
    uv run python scripts/licenses/check_licenses.py [--targets TARGET ...]
    uv run python scripts/licenses/check_licenses.py --summary summary.json
"""

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import inventory  # noqa: E402
from license_policy import get_exception  # noqa: E402

_TARGETS_LABEL = {
    inventory.FRONTEND_TARGET: "frontend (runtime bundle + dev tooling)",
}

_COLLECT_COMMAND = "uv run python scripts/licenses/collect_licenses.py"


class _Style:
    """ANSI styling for the check output, enabled per terminal detection."""

    CODES = {
        "bold": "1",
        "red": "31",
        "green": "32",
        "yellow": "33",
        "blue": "34",
        "cyan": "36",
    }

    def __init__(self) -> None:
        force = os.environ.get("FORCE_COLOR")
        enabled = (bool(force) and force != "0") or (
            sys.stdout.isatty() and "NO_COLOR" not in os.environ
        )
        self.enabled = enabled

    def __getattr__(self, name: str):
        code = self.CODES.get(name)
        if code is None:
            raise AttributeError(name)

        def style(text: str) -> str:
            if not self.enabled:
                return text
            return f"\033[{code}m{text}\033[0m"

        return style


_style = _Style()


def _print_final_guidance(classifications: list[inventory.Classification]) -> None:
    """Print the license-fulfillment guidance once for the whole run.

    Triggered only if any target actually needs it: a failure needs the
    resolve-by guidance; a shipped weak-copyleft component needs the
    distribution-requirement guidance.
    """

    def shipped_weak(classification: inventory.Classification) -> bool:
        return any(pkg.shipped for pkg, _, _ in classification.weak)

    if any(classification.failing for classification in classifications):
        print(
            _style.red(
                "\n  Resolve by: adding a reviewed entry to [tool.licensecheck.exceptions]\n"
                "  (license + version + reason) or extending the allowed/weak_copyleft\n"
                "  lists in the root pyproject.toml if the license is genuinely permissive."
            )
        )
        print(f"\n    {_style.bold(_COLLECT_COMMAND)}\n")
    elif any(shipped_weak(classification) for classification in classifications):
        print(
            "\n  The shipped weak-copyleft components (MPL/LGPL) are acceptable under\n"
            "  the policy's conditions, which the check cannot verify itself:\n"
            "  they must remain unmodified (patching them can trigger the copyleft\n"
            "  terms). Distribution requires including their license texts and\n"
            "  copyright notices (MPL: modifications to those files must be shared\n"
            "  under the MPL; LGPL: dynamic linking is fine, convey the library's\n"
            "  source availability). Generate the required third-party notices with:"
        )
        print(f"\n    {_style.bold(_COLLECT_COMMAND)}\n")


def _check_target(target: str, summary: dict) -> inventory.Classification:
    packages = inventory.target_packages(target)
    classification = inventory.classify_packages(packages)

    label = _TARGETS_LABEL.get(target, "Python service")
    print(f"\n{_style.bold(f'=== {target} ({label}) ===')}")
    print(
        f"  {len(packages)} packages: {classification.approved} approved "
        f"({classification.shipped_count} shipped, "
        f"{len(packages) - classification.shipped_count} dev-only)"
    )

    for pkg, result, license_str in classification.failing:
        exception = get_exception(pkg.name, pkg.version)
        pin_note = ""
        if exception is not None:
            if str(exception.get("version")) != str(pkg.version):
                pin_note = f" (exception pinned to {exception.get('version')}, found {pkg.version})"
            else:
                pin_note = (
                    " (exception matched, but its license value is itself unapproved)"
                )
        name = f"{pkg.name} {pkg.version}"
        license_token = pkg.license or "<no metadata>"
        print(
            f"  {_style.bold(_style.red('FAIL'))} {_style.bold(name)}: "
            f"{_style.red(license_token)}{pin_note}"
        )
        print(
            f"       resolved as: {license_str or '<no metadata>'} -> {', '.join(result['reasons'])}"
        )

    for pkg, result, license_str in classification.weak:
        kind = _style.blue("shipped") if pkg.shipped else _style.cyan("dev-only")
        print(
            f"  {_style.yellow('warn')} {pkg.name} {pkg.version} [{kind}]: "
            f"weak copyleft {_style.yellow(result['selected'])} (from: {license_str})"
        )

    for pkg, _, license_str in classification.dev_findings:
        print(
            f"  {_style.yellow('warn')} {pkg.name} {pkg.version} "
            f"[{_style.cyan('dev-only')}]: unapproved "
            f"{_style.cyan(license_str or pkg.license or '<no metadata>')} "
            "(not distributed, not enforced)"
        )

    summary[target] = {
        "total_packages": len(packages),
        "shipped_packages": classification.shipped_count,
        "approved": classification.approved,
        "weak_copyleft": [
            {
                "name": p.name,
                "version": p.version,
                "license": r["selected"],
                "shipped": p.shipped,
            }
            for p, r, _ in classification.weak
        ],
        "dev_only_findings": [
            {"name": p.name, "version": p.version, "license": lic or p.license}
            for p, _, lic in classification.dev_findings
        ],
        "failures": [
            {
                "name": p.name,
                "version": p.version,
                "license": p.license,
                "resolved": lic,
                "reasons": r["reasons"],
            }
            for p, r, lic in classification.failing
        ],
    }

    return classification


def main() -> int:
    """Run the license check over the selected targets."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--targets",
        nargs="+",
        default=list(inventory.ALL_TARGETS),
        help="Targets to check (default: all). One of: "
        + ", ".join(inventory.ALL_TARGETS),
    )
    parser.add_argument(
        "--summary",
        type=Path,
        help="Write a JSON summary to this path (for CI artifacts).",
    )
    args = parser.parse_args()

    invalid = [t for t in args.targets if t not in inventory.ALL_TARGETS]
    if invalid:
        parser.error(f"Unknown targets: {', '.join(invalid)}")

    print("Checking third-party licenses against the [tool.licensecheck] policy...")
    print("Shipped dependencies are enforced; dev-only dependencies warn only.")
    summary: dict = {}
    classifications: list[inventory.Classification] = []
    try:
        for target in args.targets:
            summary[target] = {}
            classifications.append(_check_target(target, summary))
    finally:
        if args.summary:
            args.summary.write_text(
                json.dumps(summary, indent=2, sort_keys=True), encoding="utf-8"
            )
            print(f"\nSummary written to {args.summary}")

    ok = all(not classification.failing for classification in classifications)
    if ok:
        print("\n" + _style.green("OK: no unapproved shipped dependencies."))
    else:
        print("\n" + _style.red("FAILED: unapproved shipped dependencies found."))
    _print_final_guidance(classifications)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
