"""Transcription model registry mirror.

The authoritative transcription model manifest lives in the frontend
(`mucgpt-frontend/src/config/transcriptionModels.ts`) — the frontend is the
executor and owns all download/load metadata. Core only needs to know *which
ids are valid* so `/config` can report effective availability instead of
announcing a model the frontend will silently refuse.

The list is mirrored here and kept honest by
`tests/unit/test_transcription_models.py::test_known_ids_match_frontend_registry`,
which parses the frontend manifest and fails on drift.
"""

from __future__ import annotations

KNOWN_TRANSCRIPTION_MODEL_IDS: frozenset[str] = frozenset(
    {
        "onnx-community/whisper-small",
        "onnx-community/whisper-large-v3-turbo",
        "onnx-community/whisper-large-v3-turbo-german-ONNX",
        "flackzz/distil-whisper-large-v3-german_timestamped-ONNX",
        "istupakov/canary-180m-flash-onnx",
        "efederici/parakeet-tdt-0.6b-v3-onnx-int4",
        "Olicorne/parakeet-tdt-0.6b-v3-ultra-onnx",
    }
)
