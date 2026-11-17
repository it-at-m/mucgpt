"""Notice writers shared by the CI collector and the in-image generator.

Both produce the same ``THIRD_PARTY_LICENSES/`` layout (ATTRIBUTIONS.txt,
licenses/, bom.cdx.json). Stdlib-only: the in-image generator must not depend
on uv, pip-licenses or the network.
"""

import json
from pathlib import Path
from shutil import copyfile

from license_policy import canonical_license_expression

# File name stems that carry license/attribution texts.
LICENSE_STEMS = ("license", "licence", "copying", "notice", "authors")

CATEGORY_LABEL = {
    "permissive": "permissive",
    "weak_copyleft": "weak copyleft",
    "unapproved": "UNAPPROVED - REQUIRES REVIEW",
}


def sanitize_package_name(name: str) -> str:
    """Convert a package name to a filesystem-safe stem."""
    return (
        name.replace("-", "_")
        .replace(".", "_")
        .replace("@", "")
        .replace("/", "__")
        .lower()
    )


# Extensions of code files that merely start with a license stem
# (e.g. "license-update.mjs") and are not license texts.
_CODE_SUFFIXES = {".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".py", ".json"}


def is_license_filename(name: str) -> bool:
    """True for license/attribution file names such as ``LICENSE-MIT.txt``."""
    lowered = name.lower()
    return (
        lowered.startswith(LICENSE_STEMS) and Path(lowered).suffix not in _CODE_SUFFIXES
    )


def find_license_files(package_dir: Path) -> list[str]:
    """License files directly inside a package directory (npm packages)."""
    files = []
    try:
        for entry in sorted(package_dir.iterdir()):
            if entry.is_file() and is_license_filename(entry.name):
                files.append(str(entry))
    except OSError:
        pass
    return files


def dist_info_license_files(dist_info: Path) -> list[str]:
    """License files of a Python distribution's ``.dist-info`` directory.

    Covers both flat files (``LICENSE``, ``COPYING``, ...) and the PEP 639
    ``licenses/`` subdirectory.
    """
    files = []
    if dist_info.is_dir():
        # Case-insensitive match: wheel metadata is often upper-case and
        # filesystems are case-sensitive on Linux.
        for entry in sorted(dist_info.iterdir()):
            if entry.is_file() and is_license_filename(entry.name):
                files.append(str(entry))
        licenses_dir = dist_info / "licenses"
        if licenses_dir.is_dir():
            # PEP 639 permits nested paths below licenses/ (e.g. vendored texts).
            files.extend(sorted(str(p) for p in licenses_dir.rglob("*") if p.is_file()))
    # De-duplicate while keeping a deterministic order.
    return list(dict.fromkeys(files))


def verify_notices(
    output_dir: Path, entries: list[dict], expected_counts: dict[str, int]
) -> list[str]:
    """Verify that the written notices are complete and consistent.

    Returns a list of problems: referenced files that are missing, files no
    entry points at, and package directories with an unexpected number of
    copied license texts.
    """
    problems = []
    referenced = set()
    for entry in entries:
        for relative in entry.get("license_files") or []:
            referenced.add(relative)
            if not (output_dir / relative).is_file():
                problems.append(f"missing license file: {relative}")
    actual = {
        str(path.relative_to(output_dir))
        for path in (output_dir / "licenses").rglob("*")
        if path.is_file()
    }
    problems.extend(
        f"unreferenced license file: {name}" for name in sorted(actual - referenced)
    )
    for directory, expected in sorted(expected_counts.items()):
        package_dir = output_dir / "licenses" / directory
        copied = (
            len([p for p in package_dir.glob("*") if p.is_file()])
            if package_dir.is_dir()
            else 0
        )
        if copied != expected:
            problems.append(f"{directory}: {copied} of {expected} license files copied")
    return problems


def copy_license_texts(
    package_name: str, version: str, paths: list[str], licenses_dir: Path
) -> list[str]:
    """Copy a package's license files into ``licenses/<pkg>-<version>/``.

    Original file names are preserved. Returns the relative paths (for the
    attribution entries). Unreadable entries are skipped; their absence is
    visible in the attribution block.
    """
    package_dir = licenses_dir / f"{sanitize_package_name(package_name)}-{version}"
    copied = []
    for path in paths:
        source = Path(path)
        if not source.is_file():
            continue
        package_dir.mkdir(parents=True, exist_ok=True)
        target = package_dir / source.name
        counter = 2
        while target.exists():
            target = package_dir / f"{source.stem}-{counter}{source.suffix}"
            counter += 1
        copyfile(source, target)
        copied.append(f"licenses/{package_dir.name}/{target.name}")
    return copied


def write_attributions(
    output_dir: Path,
    entries: list[dict],
    component: str,
    extra_sections: list[tuple[str, str]] | None = None,
) -> None:
    """Write the human-readable ATTRIBUTIONS.txt."""
    with open(output_dir / "ATTRIBUTIONS.txt", "w", encoding="utf-8") as f:
        f.write("=" * 80 + "\n")
        f.write("THIRD-PARTY SOFTWARE NOTICES AND INFORMATION\n")
        f.write(f"Component: {component}\n")
        f.write("=" * 80 + "\n\n")
        f.write(
            "This component incorporates third-party software from the projects listed "
            "below. The original license notices are provided to comply with the terms "
            "of use of these components.\n\n"
        )
        for entry in entries:
            f.write("-" * 80 + "\n")
            f.write(f"Package: {entry['name']} (version {entry['version']})\n")
            f.write(f"License: {entry['license']}\n")
            detected = entry.get("detected_license")
            if detected and detected != entry["license"]:
                f.write(f"Detected license: {detected}\n")
            if entry.get("selected") and entry["selected"] != entry["license"]:
                f.write(
                    f"Selected license: {entry['selected']} [{entry['category']}]\n"
                )
            else:
                f.write(f"License category: {entry['category']}\n")
            if entry.get("author"):
                f.write(f"Author: {entry['author']}\n")
            if entry.get("url"):
                f.write(f"URL: {entry['url']}\n")
            for name in entry.get("license_files") or []:
                f.write(f"License file: {name}\n")
            f.write("\n")
        for title, body in extra_sections or []:
            f.write("-" * 80 + "\n")
            f.write(f"{title}\n")
            f.write("-" * 80 + "\n\n")
            f.write(body.rstrip("\n") + "\n\n")
        f.write("=" * 80 + "\n")
        f.write(f"Total packages: {len(entries)}\n")
        f.write("=" * 80 + "\n")


def write_cyclonedx(
    output_dir: Path, entries: list[dict], component: str, ecosystem: str
) -> None:
    """Write a CycloneDX 1.5 SBOM (``bom.cdx.json``).

    - ``license.id`` is used only for identifiers admitted by the policy
      (guaranteed SPDX in this repository), ``license.expression`` for
      AND/OR expressions, ``license.name`` otherwise.
    - Policy metadata (category, detected license, exception reason) is carried
      as CycloneDX properties.
    """
    components = []
    for entry in entries:
        component_entry = {
            "type": "library",
            "name": entry["name"],
            "version": entry["version"],
            "purl": _purl(ecosystem, entry["name"], entry["version"]),
        }
        license_entry = _cyclonedx_license(entry["license"])
        if license_entry is not None:
            component_entry["licenses"] = [license_entry]
        properties = [{"name": "mucgpt:license-category", "value": entry["category"]}]
        if (
            entry.get("detected_license")
            and entry["detected_license"] != entry["license"]
        ):
            properties.append(
                {"name": "mucgpt:detected-license", "value": entry["detected_license"]}
            )
        if entry.get("policy_exception"):
            properties.append(
                {"name": "mucgpt:policy-exception", "value": entry["policy_exception"]}
            )
        component_entry["properties"] = properties
        components.append(component_entry)

    bom = {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "version": 1,
        "metadata": {
            "tools": [{"vendor": "MUCGPT", "name": "scripts/licenses"}],
            "component": {"type": "application", "name": component},
        },
        "components": components,
    }
    with open(output_dir / "bom.cdx.json", "w", encoding="utf-8") as f:
        json.dump(bom, f, indent=2, sort_keys=True)


def _purl(ecosystem: str, name: str, version: str) -> str:
    if ecosystem == "npm":
        qualifier = name.replace("@", "%40")
        return f"pkg:npm/{qualifier}@{version}"
    return f"pkg:pypi/{sanitize_package_name(name).replace('_', '-')}@{version}"


def _cyclonedx_license(license_str: str) -> dict | None:
    license_str = (license_str or "").strip()
    if not license_str or license_str.upper() in {"UNKNOWN", "UNKNOWN!"}:
        return None
    canonical = canonical_license_expression(license_str)
    if canonical is not None:
        if " OR " in canonical or " AND " in canonical:
            return {"expression": canonical}
        return {"license": {"id": canonical}}
    if " OR " in license_str or " AND " in license_str:
        return {"expression": license_str}
    return {"license": {"name": license_str}}
