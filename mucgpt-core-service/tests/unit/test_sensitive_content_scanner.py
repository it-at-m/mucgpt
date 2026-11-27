import pytest

from guardrails.sensitive_content import scan_text
from guardrails.sensitive_content.detectors import (
    ScanOptions,
    detect_credit_cards,
    detect_emails,
    detect_phone_numbers,
)
from guardrails.sensitive_content.models import Hit


def summary(text: str, **kwargs) -> set[tuple[str, str, int]]:
    report = scan_text(text, **kwargs)
    return {(f.category, f.confidence, f.count) for f in report.findings}


def private_key_fixture(kind: str = "RSA") -> str:
    """Build a PEM marker without committing a key-like literal test fixture."""
    marker = "PRIVATE" + chr(32) + "KEY"
    type_prefix = f"{kind} " if kind else ""
    return f"{'-' * 5}BEGIN {type_prefix}{marker}{'-' * 5}\nMIIE"


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        # Personal data
        ("an DE89 3704 0044 0532 0130 00 BIC COBADEFFXXX", ("iban", "certain")),
        ("AB12 DE89 3704 0044 0532 0130 00", ("iban", "certain")),
        ("IBAN: DE89370400440532013000", ("iban", "certain")),
        ("Steuer-ID: 86095742719", ("tax_id", "certain")),
        ("Nummer 86 095 742 719", ("tax_id", "likely")),
        ("SV-Nr. 15 070649 C 103", ("social_security_number", "certain")),
        ("Karte 4111 1111 1111 1111", ("credit_card", "likely")),
        ("Ausweisnummer: T220001293", ("id_document_number", "certain")),
        ("Personalausweis Nr. T22000129", ("id_document_number", "likely")),
        (
            "IDD<<T220001293<<<<<<<<<<<<<<<\nMUSTERMANN<<ERIKA",
            ("id_document_number", "certain"),
        ),
        ("Erika Mustermann, geb. 12.08.1964", ("date_of_birth", "certain")),
        ("geboren am 3. Mai 1980", ("date_of_birth", "certain")),
        ("Date of birth: 1980-05-03", ("date_of_birth", "certain")),
        ("Kontakt: max.mustermann@example.org", ("email", "certain")),
        ("Tel. (089) 233-12345", ("phone", "likely")),
        ("Password=$Summer2024!", ("credential_assignment", "likely")),
        ("Tel. 089 233-12345", ("phone", "likely")),
        ("mobil +49 170 1234567", ("phone", "likely")),
        # Secrets
        (private_key_fixture(), ("private_key", "certain")),
        (private_key_fixture("OPENSSH"), ("private_key", "certain")),
        (
            "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fw",
            ("jwt", "certain"),
        ),
        (
            "postgres://admin:S3cr3t!pw@db.internal:5432/app",
            ("connection_string", "certain"),
        ),
        (
            "Server=x;Database=y;Password=Hunter2Hunter2;",
            ("connection_string", "certain"),
        ),
        ("ghp_" + "a1" * 18, ("access_token", "certain")),
        ("AKIAIOSFODNN7EXAMPLE", ("access_token", "certain")),
        ("sk-proj-abcdefghijklmnopqrstuvwx", ("access_token", "certain")),
        ("Authorization: Bearer abcdefghij0123456789xyz", ("access_token", "likely")),
        ("password = Sommer2024!", ("credential_assignment", "likely")),
        (
            "token wurde erzeugt: q8Zr4LmP0vX2nB7cK9sD3fG6hJ1kW5tY",
            ("high_entropy_secret", "likely"),
        ),
    ],
)
def test_detects_category(text, expected):
    assert summary(text) == {(*expected, 1)}


@pytest.mark.parametrize(
    "text",
    [
        "Sitzungsprotokoll vom 12.03.2024. TOP 3: Haushalt 2025, 1.234.567 EUR.",
        "Az. 2024/1234-5 vom 01.02.2024",
        "DE89 3704 0044 0532 0130 01",  # IBAN checksum fails
        "Karte 4111 1111 1111 1112",  # Luhn fails
        "Karte 4111 1111 1111 1112 12/25",  # expiry must not bypass Luhn
        "Karte 4000 0000 0000 0000 007",  # invalid 19-digit card
        "Karte 4111 1111 1111 1111 123",  # valid prefix of an invalid card
        "Karte 4111-1111-1111-1111-123",  # same with hyphen grouping
        "Karte 4111 1111 1111 1111 13/25",  # invalid expiry month
        "Steuer-ID: 86095742718",  # MOD 11,10 check digit fails
        "SV-Nr. 15 070649 C 104",  # check digit fails
        "geb. Müller",  # birth name, not a date
        "Passwort: vergessen?",  # prose, not a credential
        "api_key: <your-key>",  # placeholder
        "password=********",
        "postgres://user:${DB_PASSWORD}@db/app",
        "Eine Version 1.2.3 und Preis 19,99 EUR",
    ],
)
def test_ignores_non_sensitive_text(text):
    assert scan_text(text).findings == ()


def test_report_contains_categories_and_counts_but_never_values():
    secret = "Hunter2Hunter2"
    iban = "DE89370400440532013000"
    report = scan_text(f"Password={secret}; IBAN {iban} und {iban}")

    serialized = report.model_dump_json()
    assert secret not in serialized and iban not in serialized
    assert {(f.category, f.count) for f in report.findings} == {
        ("credential_assignment", 1),
        ("iban", 2),
    }


def test_occurrences_use_unicode_code_point_offsets_and_stable_provenance():
    text = "😀 Kontakt: max@example.org; erneut max@example.org"
    report = scan_text(text)

    assert [
        (occurrence.start, occurrence.end, occurrence.provenance.detector)
        for occurrence in report.occurrences
    ] == [
        (text.index("max@example.org"), text.index("max@example.org") + 15, "email"),
        (text.rindex("max@example.org"), text.rindex("max@example.org") + 15, "email"),
    ]
    serialized = report.model_dump_json()
    assert "max@example.org" not in serialized


def test_overlapping_occurrences_keep_detector_priority_and_are_ordered():
    text = "postgres://admin:S3cr3t!pw@db.internal:5432/app max@example.org"
    report = scan_text(text)

    assert [occurrence.category for occurrence in report.occurrences] == [
        "connection_string",
        "email",
    ]
    assert report.occurrences[0].start < report.occurrences[1].start


def test_findings_list_secrets_before_personal_data():
    report = scan_text(f"max@example.org {private_key_fixture(kind='')}")

    assert [f.kind for f in report.findings] == ["secret", "pii"]


def test_overlapping_hits_are_counted_once_by_the_most_specific_detector():
    # The connection string contains "pw@db.internal", which looks like an email.
    assert summary("postgres://admin:S3cr3t!pw@db.internal:5432/app") == {
        ("connection_string", "certain", 1)
    }


def test_ignored_email_domains_include_subdomains():
    text = "poststelle@muenchen.de, it@intern.muenchen.de, max@example.org"

    assert summary(text, ignored_email_domains=["@Muenchen.de"]) == {
        ("email", "certain", 1)
    }


def test_disabled_categories_still_claim_their_span():
    text = "IBAN DE89 3704 0044 0532 0130 00"

    assert summary(text, disabled_categories=["iban"]) == set()


def test_full_numeric_document_reaches_final_email():
    suffix = " max@example.org"
    text = ("12345678 " * 600000)[: 5 * 1024 * 1024 - len(suffix)] + suffix
    assert any(f.category == "email" for f in scan_text(text).findings)


def test_custom_detectors_are_supported():
    def detect_marker(text, _options):
        start = text.find("GEHEIM")
        if start >= 0:
            yield Hit("credential_assignment", "secret", "likely", start, start + 6)

    report = scan_text("Vermerk: GEHEIM", detectors=(detect_marker,))

    assert report.is_flagged
    assert report.findings[0].category == "credential_assignment"


def test_email_detector_rejects_numeric_top_level_domains():
    hits = list(detect_emails("user@10.0.0.1", ScanOptions()))

    assert hits == []


@pytest.mark.parametrize(
    "card",
    [
        "4111 1111 1111 1111",
        "4111-1111-1111-1111",
        "4111111111111111",
        "4000 0000 0000 0000 006",
        "4000000000000000006",
    ],
)
@pytest.mark.parametrize("suffix", ["", " 12/25", " 01/2027"])
def test_card_detection_preserves_card_span_before_expiry(card, suffix):
    text = f"Karte {card}{suffix}"

    hits = list(detect_credit_cards(text, ScanOptions()))

    assert [text[hit.start : hit.end] for hit in hits] == [card]
    assert summary(text) == {("credit_card", "likely", 1)}


@pytest.mark.parametrize(
    ("first", "second", "separator"),
    [
        ("0891234567", "0897654321", " / "),
        ("0891234567", "+49 170 1234567", " / "),
        ("0891234567", "(089) 233-12345", "  /  "),
    ],
)
def test_alternative_phone_numbers_are_separate_findings(first, second, separator):
    text = f"Tel. {first}{separator}{second}"

    hits = list(detect_phone_numbers(text, ScanOptions()))

    assert [text[hit.start : hit.end] for hit in hits] == [first, second]
    assert summary(text) == {("phone", "likely", 2)}


@pytest.mark.parametrize("phone", ["089/23312345", "089 / 23312345"])
def test_single_slash_formatted_phone_number_is_preserved(phone):
    text = f"Tel. {phone}"

    hits = list(detect_phone_numbers(text, ScanOptions()))

    assert [text[hit.start : hit.end] for hit in hits] == [phone]
    assert summary(text) == {("phone", "likely", 1)}
