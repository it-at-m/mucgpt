from collections import Counter
from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

SensitiveContentCategory = Literal[
    # Personal data
    "email",
    "phone",
    "iban",
    "credit_card",
    "tax_id",
    "social_security_number",
    "id_document_number",
    "date_of_birth",
    # Secrets
    "private_key",
    "access_token",
    "jwt",
    "connection_string",
    "credential_assignment",
    "high_entropy_secret",
]
SensitiveContentKind = Literal["pii", "secret"]
SensitiveContentConfidence = Literal["certain", "likely"]

_KIND_ORDER: dict[SensitiveContentKind, int] = {"secret": 0, "pii": 1}
_CONFIDENCE_ORDER: dict[SensitiveContentConfidence, int] = {"certain": 0, "likely": 1}


@dataclass(frozen=True)
class Hit:
    """One detector match as a span; internal only, never persisted or returned.

    Only offsets are kept so matched values cannot leak into storage, logs or
    traces by accident.
    """

    category: SensitiveContentCategory
    kind: SensitiveContentKind
    confidence: SensitiveContentConfidence
    start: int
    end: int


class SensitiveContentFinding(BaseModel):
    """Aggregated hits of one category and confidence, without matched values."""

    model_config = ConfigDict(frozen=True)

    category: SensitiveContentCategory
    kind: SensitiveContentKind
    confidence: SensitiveContentConfidence
    count: int = Field(ge=1)


class SensitiveContentProvenance(BaseModel):
    """Stable origin of an occurrence, without the matched value."""

    model_config = ConfigDict(frozen=True)

    guardrail: Literal["sensitive_content"] = "sensitive_content"
    detector: str = Field(min_length=1)


class SensitiveContentOccurrence(BaseModel):
    """One value-free match in the exact extracted text stored for a document.

    ``start`` and ``end`` are end-exclusive Unicode code-point offsets. Python
    string indices use this coordinate system, so detector spans can be stored
    without conversion.
    """

    model_config = ConfigDict(frozen=True)

    category: SensitiveContentCategory
    kind: SensitiveContentKind
    confidence: SensitiveContentConfidence
    start: int = Field(ge=0)
    end: int = Field(gt=0)
    provenance: SensitiveContentProvenance

    @model_validator(mode="after")
    def validate_span(self) -> "SensitiveContentOccurrence":
        if self.end <= self.start:
            raise ValueError("Occurrence end must be greater than start")
        return self


class SensitiveContentReport(BaseModel):
    """Scan result for one text. Contains locations but never matched values."""

    model_config = ConfigDict(frozen=True)

    occurrences: tuple[SensitiveContentOccurrence, ...] = ()

    @property
    def findings(self) -> tuple[SensitiveContentFinding, ...]:
        """Compact aggregate view derived from the occurrence source of truth."""
        counts = Counter(
            (occurrence.category, occurrence.kind, occurrence.confidence)
            for occurrence in self.occurrences
        )
        return tuple(
            SensitiveContentFinding(
                category=category, kind=kind, confidence=confidence, count=count
            )
            for (category, kind, confidence), count in sorted(
                counts.items(),
                key=lambda item: (
                    _KIND_ORDER[item[0][1]],
                    _CONFIDENCE_ORDER[item[0][2]],
                    item[0][0],
                ),
            )
        )

    @property
    def is_flagged(self) -> bool:
        return bool(self.occurrences)
