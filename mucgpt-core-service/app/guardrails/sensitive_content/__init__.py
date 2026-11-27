"""Guardrail for detecting personal data and secrets in text.

`scan_text` is independent of documents, so chat input or other text sources
can reuse it. Reports never contain the matched values.
"""

from guardrails.sensitive_content.models import (
    SensitiveContentFinding,
    SensitiveContentOccurrence,
    SensitiveContentReport,
)
from guardrails.sensitive_content.scanner import scan_text

__all__ = [
    "SensitiveContentFinding",
    "SensitiveContentOccurrence",
    "SensitiveContentReport",
    "scan_text",
]
