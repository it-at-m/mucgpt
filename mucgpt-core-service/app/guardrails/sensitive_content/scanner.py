from collections.abc import Iterable, Sequence

from guardrails.sensitive_content.detectors import (
    DEFAULT_DETECTORS,
    Detector,
    ScanOptions,
)
from guardrails.sensitive_content.models import (
    SensitiveContentCategory,
    SensitiveContentOccurrence,
    SensitiveContentProvenance,
    SensitiveContentReport,
)

_DETECTOR_IDS = {
    "detect_private_keys": "private_key",
    "detect_jwts": "jwt",
    "detect_connection_strings": "connection_string",
    "detect_access_tokens": "access_token",
    "detect_credential_assignments": "credential_assignment",
    "detect_high_entropy_secrets": "high_entropy_secret",
    "detect_id_documents": "id_document_number",
    "detect_social_security_numbers": "social_security_number",
    "detect_ibans": "iban",
    "detect_credit_cards": "credit_card",
    "detect_tax_ids": "tax_id",
    "detect_dates_of_birth": "date_of_birth",
    "detect_emails": "email",
    "detect_phone_numbers": "phone",
}


def scan_text(
    text: str,
    *,
    ignored_email_domains: Iterable[str] = (),
    disabled_categories: Iterable[SensitiveContentCategory] = (),
    detectors: Sequence[Detector] = DEFAULT_DETECTORS,
) -> SensitiveContentReport:
    """Scan text for personal data and secrets; CPU-bound, run it off the event loop.

    The report holds offsets and detector provenance only, never matched
    values, so it is safe to persist, log and return to the client.
    """
    options = ScanOptions(
        ignored_email_domains=frozenset(
            domain.strip().lower().lstrip("@") for domain in ignored_email_domains
        )
    )
    disabled = frozenset(disabled_categories)
    claimed = bytearray(len(text))
    occurrences: list[SensitiveContentOccurrence] = []
    for detector in detectors:
        detector_name = getattr(detector, "__name__", type(detector).__name__)
        detector_id = _DETECTOR_IDS.get(
            detector_name, detector_name.removeprefix("detect_")
        )
        for hit in sorted(
            detector(text, options),
            key=lambda item: (item.start, item.end, item.category, item.confidence),
        ):
            # Disabled categories still claim their span so that, e.g., an
            # ignored IBAN is not reported again as a card or phone number.
            if claimed.find(b"\x01", hit.start, hit.end) >= 0:
                continue
            claimed[hit.start : hit.end] = b"\x01" * (hit.end - hit.start)
            if hit.category not in disabled:
                occurrences.append(
                    SensitiveContentOccurrence(
                        category=hit.category,
                        kind=hit.kind,
                        confidence=hit.confidence,
                        start=hit.start,
                        end=hit.end,
                        provenance=SensitiveContentProvenance(detector=detector_id),
                    )
                )
    return SensitiveContentReport(
        occurrences=tuple(
            sorted(
                occurrences,
                key=lambda item: (
                    item.start,
                    item.end,
                    item.provenance.detector,
                    item.category,
                    item.kind,
                    item.confidence,
                ),
            )
        )
    )
