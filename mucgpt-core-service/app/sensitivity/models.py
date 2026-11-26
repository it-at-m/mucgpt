from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SensitivityCategory = Literal[
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
SensitivityKind = Literal["pii", "secret"]
SensitivityConfidence = Literal["certain", "likely"]


@dataclass(frozen=True)
class Hit:
    """One detector match as a span; internal only, never persisted or returned.

    Only offsets are kept so matched values cannot leak into storage, logs or
    traces by accident.
    """

    category: SensitivityCategory
    kind: SensitivityKind
    confidence: SensitivityConfidence
    start: int
    end: int


class Finding(BaseModel):
    """Aggregated hits of one category and confidence, without matched values."""

    model_config = ConfigDict(frozen=True)

    category: SensitivityCategory
    kind: SensitivityKind
    confidence: SensitivityConfidence
    count: int = Field(ge=1)


class SensitivityReport(BaseModel):
    """Scan result for one text. Contains categories and counts only."""

    model_config = ConfigDict(frozen=True)

    findings: tuple[Finding, ...] = ()
    truncated: bool = Field(
        default=False,
        description="True when only the first configured characters were scanned.",
    )

    @property
    def is_flagged(self) -> bool:
        return bool(self.findings)
