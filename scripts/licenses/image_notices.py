#!/usr/bin/env python3
"""Generate THIRD_PARTY_LICENSES/ inside a service image from the shipping venv.

Stdlib-only (importlib.metadata); the policy file is set via
``MUCGPT_LICENSE_POLICY``.

Usage:
    /app/.venv/bin/python /tmp/licenses/image_notices.py /app
"""

import importlib.metadata as metadata
import subprocess
import sys
import tomllib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import notices
from license_policy import (
    effective_license,
    evaluate_license,
    get_exception,
    normalize_package_name,
)

_LICENSE_CLASSIFIER_PREFIX = "License ::"


def _license_label(dist: metadata.Distribution) -> str:
    """Best available license identifier from the distribution metadata."""
    meta = dist.metadata
    for key in ("License-Expression", "License"):
        value = (meta.get(key) or "").strip()
        if value and value.upper() not in {"UNKNOWN", "UNKNOWN!"}:
            return value
    for classifier in meta.get_all("Classifier") or []:
        if classifier.startswith(_LICENSE_CLASSIFIER_PREFIX):
            return classifier.rsplit("::", 1)[-1].strip()
    return ""


def _author_label(dist: metadata.Distribution) -> str:
    meta = dist.metadata
    for key in ("Author", "Author-email", "Maintainer"):
        value = (meta.get(key) or "").strip()
        if value:
            return value
    return ""


def _url_label(dist: metadata.Distribution) -> str:
    meta = dist.metadata
    value = (meta.get("Home-page") or "").strip()
    if value:
        return value
    for entry in meta.get_all("Project-URL") or []:
        _, _, url = entry.partition(",")
        if url.strip():
            return url.strip()
    return ""


def _license_files(dist: metadata.Distribution) -> list[str]:
    """License texts shipped inside the distribution's ``.dist-info`` directory."""
    files = []
    for file in dist.files or []:
        parts = tuple(file.parts)
        if len(parts) < 2 or not parts[0].endswith(".dist-info"):
            continue
        filename = parts[-1].lower()
        flat_license = len(parts) == 2 and any(
            filename.startswith(stem) for stem in notices.LICENSE_STEMS
        )
        pep639_license = len(parts) == 3 and parts[1].lower() == "licenses"
        if flat_license or pep639_license:
            files.append(str(dist.locate_file(file)))
    return sorted(dict.fromkeys(files))


def _local_project_name(app_dir: Path) -> str:
    pyproject = app_dir / "pyproject.toml"
    try:
        with open(pyproject, "rb") as f:
            return tomllib.load(f).get("project", {}).get("name", "")
    except OSError:
        return ""


def _rpm_section() -> tuple[str, str]:
    """System package table, when the image is RPM-based."""
    try:
        output = subprocess.run(
            ["rpm", "-qa", "--queryformat", "%{NAME} %{VERSION} %{LICENSE}\\n"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout
    except (OSError, subprocess.CalledProcessError):
        return (
            "System packages (RPM)",
            "RPM package manager not available in this image.",
        )
    lines = sorted(line for line in output.splitlines() if line.strip())
    return (
        "System packages (RPM)",
        "Full license texts for system packages are in /usr/share/licenses/.\n\n"
        "Package  Version  License\n" + "\n".join(lines),
    )


def main() -> int:
    """Generate THIRD_PARTY_LICENSES/ in the given application directory."""
    app_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("/app")
    component = _local_project_name(app_dir) or "service"
    local_name = normalize_package_name(component)

    output_dir = app_dir / "THIRD_PARTY_LICENSES"
    licenses_dir = output_dir / "licenses"
    licenses_dir.mkdir(parents=True, exist_ok=True)

    entries = []
    for dist in metadata.distributions():
        name = dist.metadata.get("Name") or ""
        if not name or normalize_package_name(name) == local_name:
            continue
        version = dist.version or "Unknown"
        detected = _license_label(dist)
        license_str = effective_license(name, version, detected)
        result = evaluate_license(license_str)
        exception = get_exception(name, version)
        entries.append(
            {
                "name": name,
                "version": version,
                "license": license_str or detected,
                "detected_license": detected or None,
                "selected": result["selected"] if result["status"] == "ok" else None,
                "category": notices.CATEGORY_LABEL.get(
                    result["category"], result["category"]
                ),
                "author": _author_label(dist),
                "url": _url_label(dist),
                "license_files": notices.copy_license_texts(
                    name, version, _license_files(dist), licenses_dir
                )
                or None,
                "policy_exception": (exception or {}).get("reason"),
            }
        )
    entries.sort(key=lambda entry: entry["name"].lower())

    notices.write_attributions(
        output_dir, entries, component, extra_sections=[_rpm_section()]
    )
    notices.write_cyclonedx(output_dir, entries, component, "pypi")
    print(
        f"Generated {output_dir} ({len(entries)} packages, "
        f"{sum(len(e['license_files'] or []) for e in entries)} license texts)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
