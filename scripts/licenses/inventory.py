"""Dependency inventory for the license scripts.

Python services are read from their own uv venv via a pip-licenses overlay
(overlay packages are filtered out); the frontend is read from node_modules
package.json files, with the shipped set taken from package-lock.json.
"""

import json
import re
import subprocess
import sys
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

from license_policy import WEAK_COPYLEFT, effective_license, evaluate_license
from notices import dist_info_license_files, find_license_files

REPO_ROOT = Path(__file__).resolve().parents[2]

PIP_LICENSES_VERSION = "5.5.5"

PYTHON_TARGETS = (
    "mucgpt-core-service",
    "mucgpt-assistant-service",
    "mucgpt-assistant-service-migrations",
)
FRONTEND_TARGET = "mucgpt-frontend"
ALL_TARGETS = (*PYTHON_TARGETS, FRONTEND_TARGET)


@dataclass
class Package:
    """One third-party dependency with its license metadata."""

    name: str
    version: str
    license: str
    author: str = ""
    url: str = ""
    shipped: bool = True  # False = dev-only, not distributed
    license_files: list[str] = field(default_factory=list)  # absolute paths


def _run(cmd: list[str], cwd: Path | None = None) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True, check=True, cwd=cwd)
    return result.stdout


def _target_project_name(target_dir: Path) -> str:
    """Name of the target's own project, to exclude it from the inventory."""
    with open(target_dir / "pyproject.toml", "rb") as f:
        return tomllib.load(f).get("project", {}).get("name", "")


def _normalize_name(name: str) -> str:
    """PEP 503 normalization for package name comparisons."""
    return re.sub(r"[-_.]+", "-", name.strip().lower())


def _exported_package_names(target_dir: Path, *, no_dev: bool) -> set[str]:
    """Package names resolved from the target's lockfile via ``uv export``."""
    cmd = [
        "uv",
        "export",
        "--project",
        str(target_dir),
        "--no-hashes",
        "--no-emit-project",
        "--no-header",
        "--quiet",
    ]
    if no_dev:
        cmd.append("--no-dev")
    names = set()
    for line in _run(cmd).splitlines():
        line = line.strip()
        if not line or line.startswith(("#", "-e")):
            continue
        # Strip environment markers and extras: "name[extra]==1.0 ; marker".
        name = line.split(" ; ")[0].split("==")[0].split("[")[0].strip()
        if name:
            names.add(_normalize_name(name))
    return names


def _dist_info_dirs(target_dir: Path) -> dict[str, Path]:
    """Map normalized package names to their ``.dist-info`` directory."""
    mapping: dict[str, Path] = {}
    for site_packages in target_dir.glob(".venv/lib/python*/site-packages"):
        for info in site_packages.glob("*.dist-info"):
            name = info.name[: -len(".dist-info")].rsplit("-", 1)[0]
            mapping.setdefault(_normalize_name(name), info)
    return mapping


def python_packages(target: str) -> list[Package]:
    """Inventory of a Python service target, from its own venv."""
    target_dir = REPO_ROOT / target
    base_names = _exported_package_names(target_dir, no_dev=False)
    shipped = _exported_package_names(target_dir, no_dev=True)
    local_name = _target_project_name(target_dir)
    dist_infos = _dist_info_dirs(target_dir)

    output = _run(
        [
            "uv",
            "run",
            "--project",
            str(target_dir),
            "--no-sync",
            "--with",
            f"pip-licenses=={PIP_LICENSES_VERSION}",
            "pip-licenses",
            "--format=json",
            "--from=mixed",
            "--with-authors",
            "--with-urls",
            "--with-license-file",
        ]
    )
    packages = []
    for pkg in json.loads(output):
        name = pkg.get("Name", "")
        normalized = _normalize_name(name)
        if not name or normalized == _normalize_name(local_name):
            continue
        # Drop the ephemeral pip-licenses overlay packages: they exist only in
        # the tooling environment, not in the venv that ships in the image.
        if normalized not in base_names:
            continue
        dist_info = dist_infos.get(normalized)
        license_files = (
            dist_info_license_files(dist_info)
            if dist_info is not None
            else [p for p in [pkg.get("LicenseFile", "")] if p]
        )
        packages.append(
            Package(
                name=name,
                version=pkg.get("Version", "Unknown"),
                license=pkg.get("License", "") or "",
                author=pkg.get("Author", "") or "",
                url=pkg.get("URL", "") or "",
                shipped=normalized in shipped,
                license_files=license_files,
            )
        )
    packages.sort(key=lambda p: p.name.lower())
    return packages


def _npm_license_field(meta: dict) -> str:
    """Normalize the various npm license field shapes to a string."""
    value = meta.get("license")
    if value is None:
        # Deprecated but still present in older packages: licenses: [{type: ..., url: ...}]
        value = meta.get("licenses")
    if isinstance(value, dict):
        return str(value.get("type", "") or "")
    if isinstance(value, list):
        parts = []
        for entry in value:
            if isinstance(entry, dict):
                entry = entry.get("type", "")
            if entry:
                parts.append(str(entry))
        return " OR ".join(parts)
    return str(value or "")


def _walk_node_modules(node_modules: Path) -> list[Path]:
    """All package directories under node_modules, including scoped and nested ones."""
    found = []
    if not node_modules.is_dir():
        return found
    for scope in node_modules.iterdir():
        if not scope.is_dir() or scope.name == ".bin":
            continue
        if scope.name.startswith("@"):
            for pkg_dir in sorted(scope.iterdir()):
                if pkg_dir.is_dir() and (pkg_dir / "package.json").is_file():
                    found.append(pkg_dir)
                    # Nested dependencies of scoped packages live here.
                    found.extend(_walk_node_modules(pkg_dir / "node_modules"))
        elif (scope / "package.json").is_file():
            found.append(scope)
            found.extend(_walk_node_modules(scope / "node_modules"))
        else:
            found.extend(_walk_node_modules(scope / "node_modules"))
    return found


def _prod_closure_from_lock(target: str) -> set[str]:
    """Package names shipped to production, from package-lock.json.

    Traverses the lockfile's ``packages`` entries and keeps every package that
    is not flagged as a dev dependency. This is deterministic, needs no npm
    subprocess and fails closed: a missing or unreadable lockfile raises
    instead of degrading to an empty (all-pass) closure.
    """
    lock_path = REPO_ROOT / target / "package-lock.json"
    try:
        with open(lock_path, "rb") as f:
            lock = json.load(f)
    except (OSError, ValueError) as error:
        raise RuntimeError(
            f"Cannot read {lock_path}: {error}. The frontend license check "
            "treats this as a failure (fail-closed); run 'npm ci' in "
            f"{target} first."
        ) from error

    names = set()
    for key, entry in lock.get("packages", {}).items():
        if key == "" or not isinstance(entry, dict):
            continue
        if entry.get("dev"):
            continue
        name = key.split("node_modules/")[-1]
        if name:
            names.add(name)
    return names


def frontend_packages(target: str) -> list[Package]:
    """Inventory of the frontend target, from node_modules package.json files."""
    node_modules = REPO_ROOT / target / "node_modules"
    with open(REPO_ROOT / target / "package.json", "rb") as f:
        manifest = json.load(f)
    local_name = manifest.get("name", "")
    prod_closure = _prod_closure_from_lock(target)

    packages = []
    seen = set()
    for pkg_dir in _walk_node_modules(node_modules):
        with open(pkg_dir / "package.json", "rb") as f:
            meta = json.load(f)
        name = meta.get("name", "")
        version = str(meta.get("version", "Unknown"))
        if not name or name == local_name:
            continue
        key = (name, version)
        if key in seen:
            continue
        seen.add(key)
        packages.append(
            Package(
                name=name,
                version=version,
                license=_npm_license_field(meta),
                author=(meta.get("author") or {}).get("name", "")
                if isinstance(meta.get("author"), dict)
                else str(meta.get("author") or ""),
                url=_npm_repo_url(meta.get("repository")),
                shipped=name in prod_closure,
                license_files=find_license_files(pkg_dir),
            )
        )
    packages.sort(key=lambda p: (not p.shipped, p.name.lower()))
    return packages


def _npm_repo_url(value) -> str:
    if isinstance(value, dict):
        return str(value.get("url", "") or "")
    return str(value or "")


def target_packages(target: str) -> list[Package]:
    """Inventory of one target by directory name."""
    if target in PYTHON_TARGETS:
        return python_packages(target)
    if target == FRONTEND_TARGET:
        return frontend_packages(target)
    raise ValueError(
        f"Unknown target: {target}. Choose one of: {', '.join(ALL_TARGETS)}"
    )


@dataclass
class Classification:
    """Policy evaluation result for a package list.

    ``all`` holds every (package, evaluation result, effective license string)
    triple; ``weak`` / ``dev_findings`` / ``failing`` are derived buckets and
    only ``failing`` blocks the gate.
    """

    all: list = field(default_factory=list)
    approved: int = 0
    shipped_count: int = 0

    @property
    def weak(self) -> list:
        return [
            entry
            for entry in self.all
            if entry[1]["status"] == "ok" and entry[1]["category"] == WEAK_COPYLEFT
        ]

    @property
    def dev_findings(self) -> list:
        return [
            entry
            for entry in self.all
            if entry[1]["status"] != "ok" and not entry[0].shipped
        ]

    @property
    def failing(self) -> list:
        return [
            entry
            for entry in self.all
            if entry[1]["status"] != "ok" and entry[0].shipped
        ]


def classify_packages(packages: list[Package]) -> Classification:
    """Classify packages against the [tool.licensecheck] policy.

    Single classification path used by both the gate (check_licenses.py) and
    the collector (collect_licenses.py), so the two can never disagree.
    """
    classification = Classification()
    for pkg in packages:
        license_str = effective_license(pkg.name, pkg.version, pkg.license)
        result = evaluate_license(license_str)
        classification.all.append((pkg, result, license_str))
        if pkg.shipped:
            classification.shipped_count += 1
        if result["status"] == "ok" and result["category"] != WEAK_COPYLEFT:
            classification.approved += 1
    return classification


def main() -> int:
    """Print a compact inventory overview for all targets (debug helper)."""
    for target in ALL_TARGETS:
        packages = target_packages(target)
        print(
            f"{target}: {len(packages)} packages ({sum(1 for p in packages if p.shipped)} shipped)"
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
