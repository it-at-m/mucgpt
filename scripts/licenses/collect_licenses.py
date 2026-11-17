#!/usr/bin/env python3
"""Write THIRD_PARTY_LICENSES/ notices for the shipped dependencies of a target.

Creates ATTRIBUTIONS.txt, verbatim license texts and a CycloneDX SBOM.

Usage:
    uv run python scripts/licenses/collect_licenses.py [--targets TARGET ...]
    uv run python scripts/licenses/collect_licenses.py --output /tmp/notices
"""

import argparse
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import inventory
import notices
from license_policy import get_exception

_ECOSYSTEM = {
    inventory.FRONTEND_TARGET: "npm",
}


def collect_target(target: str, output_root: Path) -> bool:
    """Collect notices for one target. Returns True if no unapproved licenses."""
    shipped = [p for p in inventory.target_packages(target) if p.shipped]
    classification = inventory.classify_packages(shipped)
    output_dir = output_root / target / "THIRD_PARTY_LICENSES"
    if output_dir.exists():
        shutil.rmtree(output_dir)
    licenses_dir = output_dir / "licenses"
    licenses_dir.mkdir(parents=True, exist_ok=True)

    entries = []
    for pkg, result, license_str in sorted(
        classification.all, key=lambda entry: entry[0].name.lower()
    ):
        category = result["category"]
        selected = result["selected"] if result["status"] == "ok" else None
        exception = get_exception(pkg.name, pkg.version)
        entries.append(
            {
                "name": pkg.name,
                "version": pkg.version,
                "license": license_str or pkg.license,
                "detected_license": pkg.license or None,
                "selected": selected,
                "category": notices.CATEGORY_LABEL.get(category, category),
                "author": pkg.author,
                "url": pkg.url,
                "license_files": notices.copy_license_texts(
                    pkg.name, pkg.version, pkg.license_files, licenses_dir
                )
                or None,
                "policy_exception": (exception or {}).get("reason"),
            }
        )

    notices.write_attributions(output_dir, entries, target)
    notices.write_cyclonedx(output_dir, entries, target, _ECOSYSTEM.get(target, "pypi"))
    violations = len(classification.failing)
    print(
        f"{target}: {len(entries)} shipped packages -> {output_dir}"
        + (f"  ({violations} UNAPPROVED)" if violations else "")
    )
    return not classification.failing


def main() -> int:
    """Collect license notices for the selected targets."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--targets",
        nargs="+",
        default=list(inventory.ALL_TARGETS),
        help="Targets to collect (default: all). One of: "
        + ", ".join(inventory.ALL_TARGETS),
    )
    parser.add_argument(
        "--output", type=Path, help="Output root (default: the repository root)."
    )
    args = parser.parse_args()

    invalid = [t for t in args.targets if t not in inventory.ALL_TARGETS]
    if invalid:
        parser.error(f"Unknown targets: {', '.join(invalid)}")

    output_root = args.output if args.output else inventory.REPO_ROOT
    print(f"Collecting license notices for: {', '.join(args.targets)}")
    ok = True
    for target in args.targets:
        ok = collect_target(target, output_root) and ok

    if not ok:
        print(
            "\nNote: some packages have unapproved licenses - run check_licenses.py for details."
        )
        return 1
    print("\nDone: all collected packages use approved licenses.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
