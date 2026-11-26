from bisect import bisect_right, insort
from collections import Counter
from collections.abc import Iterable, Sequence

from sensitivity.detectors import DEFAULT_DETECTORS, Detector, ScanOptions
from sensitivity.models import (
    Finding,
    SensitivityCategory,
    SensitivityConfidence,
    SensitivityKind,
    SensitivityReport,
)

_KIND_ORDER: dict[SensitivityKind, int] = {"secret": 0, "pii": 1}
_CONFIDENCE_ORDER: dict[SensitivityConfidence, int] = {"certain": 0, "likely": 1}


class _ClaimedSpans:
    """Non-overlapping spans; the first detector to claim a span wins."""

    def __init__(self) -> None:
        self._spans: list[tuple[int, int]] = []

    def claim(self, start: int, end: int) -> bool:
        index = bisect_right(self._spans, (start, end))
        if index > 0 and self._spans[index - 1][1] > start:
            return False
        if index < len(self._spans) and self._spans[index][0] < end:
            return False
        insort(self._spans, (start, end))
        return True


def scan_text(
    text: str,
    *,
    max_chars: int | None = None,
    ignored_email_domains: Iterable[str] = (),
    disabled_categories: Iterable[SensitivityCategory] = (),
    detectors: Sequence[Detector] = DEFAULT_DETECTORS,
) -> SensitivityReport:
    """Scan text for personal data and secrets; CPU-bound, run it off the event loop.

    The report holds categories and counts only, never matched values, so it
    is safe to persist, log and return to the client.
    """
    truncated = max_chars is not None and len(text) > max_chars
    if truncated:
        text = text[:max_chars]
    options = ScanOptions(
        ignored_email_domains=frozenset(
            domain.strip().lower().lstrip("@") for domain in ignored_email_domains
        )
    )
    disabled = frozenset(disabled_categories)
    claimed = _ClaimedSpans()
    counts: Counter[
        tuple[SensitivityCategory, SensitivityKind, SensitivityConfidence]
    ] = Counter()
    for detector in detectors:
        for hit in detector(text, options):
            # Disabled categories still claim their span so that, e.g., an
            # ignored IBAN is not reported again as a card or phone number.
            if claimed.claim(hit.start, hit.end) and hit.category not in disabled:
                counts[(hit.category, hit.kind, hit.confidence)] += 1
    findings = sorted(
        (
            Finding(category=category, kind=kind, confidence=confidence, count=count)
            for (category, kind, confidence), count in counts.items()
        ),
        key=lambda f: (
            _KIND_ORDER[f.kind],
            _CONFIDENCE_ORDER[f.confidence],
            f.category,
        ),
    )
    return SensitivityReport(findings=tuple(findings), truncated=truncated)
