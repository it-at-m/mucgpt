"""Reusable detection of personal data and secrets in text.

`scan_text` is independent of documents, so chat input or other text sources
can reuse it. Reports never contain the matched values.
"""

from sensitivity.models import Finding, SensitivityReport
from sensitivity.scanner import scan_text

__all__ = ["Finding", "SensitivityReport", "scan_text"]
