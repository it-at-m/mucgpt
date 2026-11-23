"""Dependency inventory for the license scripts.

Python services are read from their own uv venv via a pip-licenses overlay
(overlay packages are filtered out); the frontend is read from node_modules
package.json files, with the shipped set taken from package-lock.json.
"""

import json
import os
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
    ecosystem: str = ""  # overrides the target's default purl ecosystem


def _run(cmd: list[str]) -> str:
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
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


def _walk_node_modules(node_modules: Path, prefix: str = "") -> list[tuple[Path, str]]:
    """All package directories under node_modules with their lockfile identity.

    ``ident`` is the package directory path relative to the root node_modules
    directory (e.g. ``@scope/pkg`` or ``parent/node_modules/child``) - exactly
    the npm lockfile key minus its leading ``node_modules/`` segment. npm
    aliases keep the alias as the directory name, so identity is path-based,
    not name-based.
    """
    found: list[tuple[Path, str]] = []
    if not node_modules.is_dir():
        return found
    for scope in sorted(node_modules.iterdir()):
        if not scope.is_dir() or scope.name == ".bin":
            continue
        if scope.name.startswith("@"):
            for pkg_dir in sorted(scope.iterdir()):
                if pkg_dir.is_dir() and (pkg_dir / "package.json").is_file():
                    ident = f"{prefix}{scope.name}/{pkg_dir.name}"
                    found.append((pkg_dir, ident))
                    # Nested dependencies of scoped packages live here; the
                    # lockfile identity keeps the literal node_modules segment.
                    found.extend(
                        _walk_node_modules(
                            pkg_dir / "node_modules", ident + "/node_modules/"
                        )
                    )
        elif (scope / "package.json").is_file():
            ident = f"{prefix}{scope.name}"
            found.append((scope, ident))
            found.extend(
                _walk_node_modules(scope / "node_modules", ident + "/node_modules/")
            )
        else:
            found.extend(
                _walk_node_modules(
                    scope / "node_modules", prefix + scope.name + "/node_modules/"
                )
            )
    return found


def _frontend_dir(target: str) -> Path:
    """Frontend project directory; overridable for in-image generation."""
    override = os.environ.get("MUCGPT_FRONTEND_DIR")
    return Path(override) if override else REPO_ROOT / target


def _lockfile_table(target: str) -> dict[str, dict]:
    """npm lockfile ``packages`` entries keyed by their install identity.

    The key is the lockfile key minus its leading ``node_modules/`` segment -
    the identity ``_walk_node_modules`` computes for an installed package
    directory. Entries carry npm's metadata (``version``, ``dev`` flag, ...).
    Fails closed when the lockfile is missing or unreadable.
    """
    lock_path = _frontend_dir(target) / "package-lock.json"
    try:
        with open(lock_path, "rb") as f:
            lock = json.load(f)
    except (OSError, ValueError) as error:
        raise RuntimeError(
            f"Cannot read {lock_path}: {error}. The frontend license check "
            "treats this as a failure (fail-closed); run 'npm ci' in "
            f"{target} first."
        ) from error

    table: dict[str, dict] = {}
    for key, entry in lock.get("packages", {}).items():
        if key == "" or not isinstance(entry, dict):
            continue
        if not key.startswith("node_modules/"):
            continue
        table[key[len("node_modules/") :]] = entry
    return table


def _parse_source_file(path: Path) -> dict[str, str]:
    """Parse ``Key: value`` metadata lines from a vendored SOURCE.txt file."""
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return {}
    metadata: dict[str, str] = {}
    for line in text.splitlines():
        match = re.match(r"^([A-Za-z][A-Za-z ]+):\s*(\S.*)$", line)
        if match:
            metadata.setdefault(match.group(1).strip(), match.group(2).strip())
    return metadata


def _vendored_packages(frontend_dir: Path) -> list[Package]:
    """Inventory of vendored components under ``public/vendor/*/``.

    By convention each vendored component directory carries a license file and
    an optional ``SOURCE.txt`` with ``Version/Source/License`` metadata lines
    (parenthetical remarks are stripped; versions are reduced to their first
    token). Vendored components always ship inside the frontend bundle.
    """
    vendor_dir = frontend_dir / "public" / "vendor"
    if not vendor_dir.is_dir():
        return []
    packages = []
    for component_dir in sorted(p for p in vendor_dir.iterdir() if p.is_dir()):
        # Components without a discoverable license text are kept: their
        # declared (or missing) license is still evaluated by the policy.
        license_files = find_license_files(component_dir)
        metadata = _parse_source_file(component_dir / "SOURCE.txt")
        license_str = metadata.get("License", "").split("(")[0].strip()
        packages.append(
            Package(
                name=component_dir.name,
                version=metadata.get("Version", "Unknown").split()[0],
                license=license_str,
                url=metadata.get("Source", ""),
                shipped=True,
                license_files=license_files,
                ecosystem="generic",
            )
        )
    return packages


def frontend_packages(target: str) -> list[Package]:
    """Inventory of the frontend target, from node_modules package.json files.

    Membership in the production bundle is decided per installation identity
    (the package directory path relative to the root node_modules directory),
    not by package name: npm aliases install under the alias directory name,
    and nested duplicates can mix production and dev-only instances of one
    package.
    """
    project_dir = _frontend_dir(target)
    node_modules = project_dir / "node_modules"
    if not node_modules.is_dir():
        raise RuntimeError(
            f"Cannot inventory {target}: {node_modules} is missing. The frontend "
            "license check treats this as a failure (fail-closed); run 'npm ci' in "
            f"{target} first."
        )
    with open(project_dir / "package.json", "rb") as f:
        manifest = json.load(f)
    local_name = manifest.get("name", "")
    lock_table = _lockfile_table(target)

    by_key: dict[tuple[str, str], Package] = {}
    prod_keys: set[tuple[str, str]] = set()
    for pkg_dir, ident in _walk_node_modules(node_modules):
        with open(pkg_dir / "package.json", "rb") as f:
            meta = json.load(f)
        name = meta.get("name", "")
        version = str(meta.get("version", "Unknown"))
        if not name or name == local_name:
            continue
        entry = lock_table.get(ident)
        # Unknown installation identity: fail closed and classify as shipped.
        shipped = True if entry is None else not entry.get("dev", False)
        key = (name, version)
        if shipped:
            prod_keys.add(key)
        if key in by_key:
            continue
        by_key[key] = Package(
            name=name,
            version=version,
            license=_npm_license_field(meta),
            author=(meta.get("author") or {}).get("name", "")
            if isinstance(meta.get("author"), dict)
            else str(meta.get("author") or ""),
            url=_npm_repo_url(meta.get("repository")),
            shipped=False,
            license_files=find_license_files(pkg_dir),
        )
    # Deduplicate by (name, version): production membership wins when the
    # same package is installed multiple times (nested duplicates).
    for key in prod_keys:
        by_key[key].shipped = True
    packages = list(by_key.values())
    packages.extend(_vendored_packages(project_dir))
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
