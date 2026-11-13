"""Keeps the core transcription model mirror in sync with the frontend registry.

The frontend manifest (`mucgpt-frontend/src/config/transcriptionModels.ts`) is
the authoritative source: the frontend owns the model metadata and executes the
model. Core only mirrors the ids so `/config` can validate the configured
`TRANSCRIPTION_MODEL` and report effective availability. A pure text scan keeps
this test dependency-free (no TS tooling needed).
"""

import re
from pathlib import Path

import pytest

from config.transcription_models import KNOWN_TRANSCRIPTION_MODEL_IDS

# Repository-relative path of the authoritative frontend registry. CI checks
# out the whole monorepo, so the manifest is always present.
FRONTEND_REGISTRY_PATH = (
    Path(__file__).resolve().parents[3]
    / "mucgpt-frontend"
    / "src"
    / "config"
    / "transcriptionModels.ts"
)

# Matches `model_id: "org/repo"` in both active and commented-out lines; the
# commented entries are excluded manually below via the `//`-prefix check.
MODEL_ID_PATTERN = re.compile(r'^\s*model_id:\s*"([^"]+)"', re.MULTILINE)


def _commented_out(line: str) -> bool:
    stripped = line.strip()
    return stripped.startswith("//")


@pytest.mark.unit
def test_known_ids_match_frontend_registry():
    """Core's known transcription model ids mirror the frontend registry exactly."""
    manifest = FRONTEND_REGISTRY_PATH.read_text(encoding="utf-8")
    active_ids = set()
    for line in manifest.splitlines():
        match = MODEL_ID_PATTERN.match(line)
        if not match or _commented_out(line):
            continue
        active_ids.add(match.group(1))

    assert FRONTEND_REGISTRY_PATH.exists(), "frontend registry file missing"
    assert active_ids, "no active model ids found in the frontend registry"
    assert active_ids == set(KNOWN_TRANSCRIPTION_MODEL_IDS), (
        "transcription model ids drifted between core and frontend: "
        f"only in frontend: {sorted(active_ids - set(KNOWN_TRANSCRIPTION_MODEL_IDS))}, "
        f"only in core: {sorted(set(KNOWN_TRANSCRIPTION_MODEL_IDS) - active_ids)}"
    )


@pytest.mark.unit
def test_default_example_model_is_known():
    """The example/default model id from config examples is a known registry entry."""
    assert "istupakov/canary-180m-flash-onnx" in KNOWN_TRANSCRIPTION_MODEL_IDS
