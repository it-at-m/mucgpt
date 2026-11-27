"""Deterministic detectors for personal data and secrets in extracted text.

Each detector yields spans (`Hit`), never matched values. Checksums and
context keywords decide between "certain" and "likely". Detectors may overlap;
the scanner keeps the first hit per span in `DEFAULT_DETECTORS` order, so more
specific detectors come first.
"""

import math
import re
from collections import Counter
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass, field

from guardrails.sensitive_content.models import (
    Hit,
    SensitiveContentCategory,
    SensitiveContentConfidence,
    SensitiveContentKind,
)


@dataclass(frozen=True)
class ScanOptions:
    ignored_email_domains: frozenset[str] = field(default_factory=frozenset)


Detector = Callable[[str, ScanOptions], Iterable[Hit]]


def _hit(
    category: SensitiveContentCategory,
    kind: SensitiveContentKind,
    confidence: SensitiveContentConfidence,
    match: re.Match[str],
    group: int = 0,
) -> Hit:
    return Hit(category, kind, confidence, match.start(group), match.end(group))


def _has_context(text: str, start: int, pattern: re.Pattern[str], window: int) -> bool:
    return pattern.search(text, max(0, start - window), start) is not None


_PLACEHOLDER_WORDS = frozenset(
    {
        "password",
        "passwort",
        "kennwort",
        "changeme",
        "secret",
        "example",
        "beispiel",
        "none",
        "null",
        "true",
        "false",
        "undefined",
        "redacted",
    }
)


def _is_placeholder(value: str) -> bool:
    lowered = value.lower()
    return (
        lowered in _PLACEHOLDER_WORDS
        or set(value) <= set("*xX•.-_<>#?")
        or value.startswith(("<", "${", "{{", "%("))
        or re.fullmatch(r"\$[A-Z_][A-Z0-9_]*", value) is not None
        or "xxx" in lowered
        or "***" in value
    )


def _shannon_entropy(value: str) -> float:
    counts = Counter(value)
    length = len(value)
    return -sum(n / length * math.log2(n / length) for n in counts.values())


# --- Secrets ---------------------------------------------------------------

_PRIVATE_KEY_RE = re.compile(r"-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----")


def detect_private_keys(text: str, _options: ScanOptions) -> Iterator[Hit]:
    for match in _PRIVATE_KEY_RE.finditer(text):
        yield _hit("private_key", "secret", "certain", match)


_JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}")


def detect_jwts(text: str, _options: ScanOptions) -> Iterator[Hit]:
    for match in _JWT_RE.finditer(text):
        yield _hit("jwt", "secret", "certain", match)


_URL_CREDENTIALS_RE = re.compile(
    r"\b[a-zA-Z][a-zA-Z0-9+.-]{1,30}://[^\s:/@]{1,256}:([^\s@/]{1,256})@[^\s/]+"
)
_KEY_VALUE_CREDENTIAL_RE = re.compile(
    r"(?i:\b(?:accountkey|sharedaccesskey|password|pwd))=([^;\s\"']{8,512})"
)
_KEY_VALUE_PAIR_RE = re.compile(r"\w+=[^;\s]*;")


def detect_connection_strings(text: str, _options: ScanOptions) -> Iterator[Hit]:
    for match in _URL_CREDENTIALS_RE.finditer(text):
        if not _is_placeholder(match.group(1)):
            yield _hit("connection_string", "secret", "certain", match)
    for match in _KEY_VALUE_CREDENTIAL_RE.finditer(text):
        # Only key=value;key=value strings; prose assignments are handled by
        # detect_credential_assignments with a weaker confidence.
        if not _is_placeholder(match.group(1)) and _has_context(
            text, match.start(), _KEY_VALUE_PAIR_RE, 300
        ):
            yield _hit("connection_string", "secret", "certain", match)


_ACCESS_TOKEN_RES = (
    re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"),  # AWS access key ID
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{36,255}\b"),  # GitHub
    re.compile(r"\bgithub_pat_[A-Za-z0-9_]{60,255}\b"),
    re.compile(r"\bglpat-[A-Za-z0-9_-]{20,}"),  # GitLab
    re.compile(r"\bxox[abposr]-[A-Za-z0-9-]{10,}"),  # Slack
    re.compile(r"\bsk-[A-Za-z0-9_-]{20,}"),  # OpenAI, Anthropic, Langfuse, ...
    re.compile(r"\bAIza[0-9A-Za-z_-]{35}"),  # Google API key
    re.compile(r"\b(?:sk|rk)_live_[0-9A-Za-z]{24,}"),  # Stripe
    re.compile(r"\bhf_[A-Za-z0-9]{34,}"),  # Hugging Face
    re.compile(r"\bnpm_[A-Za-z0-9]{36}\b"),
    re.compile(r"\bsig=[A-Za-z0-9%+/]{40,}={0,2}"),  # Azure SAS signature
)
_BEARER_RE = re.compile(r"(?i:\bbearer)\s+([A-Za-z0-9._~+/-]{20,}=*)")


def detect_access_tokens(text: str, _options: ScanOptions) -> Iterator[Hit]:
    for pattern in _ACCESS_TOKEN_RES:
        for match in pattern.finditer(text):
            yield _hit("access_token", "secret", "certain", match)
    for match in _BEARER_RE.finditer(text):
        if not _is_placeholder(match.group(1)):
            yield _hit("access_token", "secret", "likely", match, 1)


_CREDENTIAL_ASSIGNMENT_RE = re.compile(
    r"(?i:\b(?:password|passwort|kennwort|passwd|pwd|secret|client[_-]?secret"
    r"|api[_-]?key|access[_-]?key|access[_-]?token|auth[_-]?token|token"
    r"|private[_-]?key))\b[\"']?\s*[:=]\s*[\"']?([^\s\"',;]{6,256})"
)


def _looks_like_credential(value: str) -> bool:
    classes = sum(
        (
            any(c.islower() for c in value),
            any(c.isupper() for c in value),
            any(c.isdigit() for c in value),
            any(not c.isalnum() for c in value),
        )
    )
    # Prose such as "Passwort: vergessen?" has neither digits nor mixed classes.
    return any(c.isdigit() for c in value) or classes >= 3


def detect_credential_assignments(text: str, _options: ScanOptions) -> Iterator[Hit]:
    for match in _CREDENTIAL_ASSIGNMENT_RE.finditer(text):
        value = match.group(1)
        if not _is_placeholder(value) and _looks_like_credential(value):
            yield _hit("credential_assignment", "secret", "likely", match, 1)


_SECRET_KEYWORD_TOKEN_RE = re.compile(
    r"(?i:\b(?:token|secret|key|apikey|api_key|credentials?|authorization"
    r"|schlüssel|zugangsdaten))\b[^\n]{0,30}?([A-Za-z0-9+/_=-]{32,512})"
)


def detect_high_entropy_secrets(text: str, _options: ScanOptions) -> Iterator[Hit]:
    for match in _SECRET_KEYWORD_TOKEN_RE.finditer(text):
        value = match.group(1)
        if (
            any(c.isdigit() for c in value)
            and any(c.isalpha() for c in value)
            and _shannon_entropy(value) >= 3.5
        ):
            yield _hit("high_entropy_secret", "secret", "likely", match, 1)


# --- Personal data -----------------------------------------------------------

_MRZ_RE = re.compile(r"(?m)^(?:I[A-Z<]|P[A-Z<]|ID)[A-Z<]{3}[A-Z0-9<]{25,39}$")
_ID_NUMBER_RE = re.compile(
    r"(?i:\b(?:personalausweis|ausweis|reisepass|pass)(?:[\s-]*(?:nr|nummer|no|number))?)"
    r"\b\.?\s*:?\s*([CFGHJKLMNPRTVWXYZ0-9]{9})(\d)?(?![A-Za-z0-9])"
)


def _icao_check_digit(value: str) -> int:
    weights = (7, 3, 1)
    total = 0
    for index, char in enumerate(value):
        number = 0 if char == "<" else int(char, 36)
        total += number * weights[index % 3]
    return total % 10


def detect_id_documents(text: str, _options: ScanOptions) -> Iterator[Hit]:
    for match in _MRZ_RE.finditer(text):
        if "<<" in match.group(0):
            yield _hit("id_document_number", "pii", "certain", match)
    for match in _ID_NUMBER_RE.finditer(text):
        number, check = match.group(1), match.group(2)
        if not any(c.isdigit() for c in number):
            continue
        if check is not None and _icao_check_digit(number) == int(check):
            yield Hit(
                "id_document_number", "pii", "certain", match.start(1), match.end(2)
            )
        else:
            yield _hit("id_document_number", "pii", "likely", match, 1)


_SOCIAL_SECURITY_RE = re.compile(
    r"(?<![\w-])(\d{2}) ?(\d{2})(\d{2})(\d{2}) ?([A-Z]) ?(\d{2})(\d)(?![\w-])"
)
_SOCIAL_SECURITY_WEIGHTS = (2, 1, 2, 5, 7, 1, 2, 1, 2, 1, 2, 1)


def _is_valid_social_security_number(match: re.Match[str]) -> bool:
    area, day, month, year, letter, serial, check = match.groups()
    if not (1 <= int(day) <= 31 and 1 <= int(month) <= 12):
        return False
    digits = f"{area}{day}{month}{year}{ord(letter) - 64:02d}{serial}"
    total = sum(
        sum(divmod(int(digit) * weight, 10))
        for digit, weight in zip(digits, _SOCIAL_SECURITY_WEIGHTS, strict=True)
    )
    return total % 10 == int(check)


def detect_social_security_numbers(text: str, _options: ScanOptions) -> Iterator[Hit]:
    """German Rentenversicherungs-/Sozialversicherungsnummer with check digit."""
    for match in _SOCIAL_SECURITY_RE.finditer(text):
        if _is_valid_social_security_number(match):
            yield _hit("social_security_number", "pii", "certain", match)


_IBAN_RE = re.compile(r"(?=(\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b))")
_IBAN_LENGTHS = {
    "AT": 20,
    "BE": 16,
    "CH": 21,
    "CZ": 24,
    "DE": 22,
    "DK": 18,
    "ES": 24,
    "FI": 18,
    "FR": 27,
    "GB": 22,
    "GR": 27,
    "HR": 21,
    "HU": 28,
    "IE": 22,
    "IT": 27,
    "LI": 21,
    "LU": 20,
    "NL": 18,
    "NO": 15,
    "PL": 28,
    "PT": 25,
    "SE": 24,
    "SI": 19,
    "SK": 24,
}


def _is_valid_iban(compact: str) -> bool:
    expected = _IBAN_LENGTHS.get(compact[:2])
    if expected is not None and len(compact) != expected:
        return False
    if not 15 <= len(compact) <= 34:
        return False
    rearranged = compact[4:] + compact[:4]
    return int("".join(str(int(char, 36)) for char in rearranged)) % 97 == 1


def detect_ibans(text: str, _options: ScanOptions) -> Iterator[Hit]:
    for match in _IBAN_RE.finditer(text):
        # The pattern may swallow a following uppercase token ("... 00 BIC");
        # try the longest prefix ending at a group boundary that validates.
        parts = match.group(1).split(" ")
        for size in range(len(parts), 0, -1):
            if _is_valid_iban("".join(parts[:size])):
                end = match.start() + len(" ".join(parts[:size]))
                yield Hit("iban", "pii", "certain", match.start(), end)
                break


_CREDIT_CARD_RE = re.compile(r"(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])")
_CARD_EXPIRY_SUFFIX_RE = re.compile(r"[ -](?:0[1-9]|1[0-2])/(?:\d{4}|\d{2})(?![\w/])")


def _luhn(digits: str) -> bool:
    total = 0
    for index, char in enumerate(reversed(digits)):
        number = int(char)
        if index % 2 == 1:
            number *= 2
            if number > 9:
                number -= 9
        total += number
    return total % 10 == 0


def _has_card_prefix(digits: str) -> bool:
    length = len(digits)
    if digits.startswith("4"):
        return length in (13, 16, 19)
    if digits[:2] in ("34", "37"):
        return length == 15
    if 51 <= int(digits[:2]) <= 55 or 2221 <= int(digits[:4]) <= 2720:
        return length == 16
    if digits.startswith(("6011", "65", "35")) or 644 <= int(digits[:3]) <= 649:
        return 16 <= length <= 19
    return False


def detect_credit_cards(text: str, _options: ScanOptions) -> Iterator[Hit]:
    for match in _CREDIT_CARD_RE.finditer(text):
        value = match.group(0)
        # Trailing expiry digits can be swallowed by the greedy candidate.
        # Prefer the full card; recover a prefix only before an MM/YY or MM/YYYY
        # expiry, never from an invalid longer card with arbitrary extra digits.
        ends = [separator.start() for separator in re.finditer(r"[ -]", value)]
        for end in reversed([*ends, len(value)]):
            if end < len(value) and not _CARD_EXPIRY_SUFFIX_RE.match(
                text, match.start() + end
            ):
                continue
            digits = re.sub(r"\D", "", value[:end])
            if len(digits) < 13:
                break
            if _has_card_prefix(digits) and _luhn(digits):
                yield Hit(
                    "credit_card", "pii", "likely", match.start(), match.start() + end
                )
                break


_TAX_ID_RE = re.compile(r"(?<![\d/-])([1-9]\d) ?(\d{3}) ?(\d{3}) ?(\d{3})(?![\d/-])")
_TAX_ID_CONTEXT_RE = re.compile(
    r"(?i:steuer|idnr|id-nr|identifikationsnummer|\btin\b|\btax\b)"
)


def _is_valid_tax_id(digits: str) -> bool:
    """German Steuer-Identifikationsnummer: digit structure and ISO 7064 MOD 11,10."""
    repeated = [n for n in Counter(digits[:10]).values() if n > 1]
    if len(repeated) != 1 or repeated[0] not in (2, 3):
        return False
    product = 10
    for char in digits[:10]:
        total = (int(char) + product) % 10 or 10
        product = (total * 2) % 11
    check = 11 - product
    return (0 if check == 10 else check) == int(digits[10])


def detect_tax_ids(text: str, _options: ScanOptions) -> Iterator[Hit]:
    for match in _TAX_ID_RE.finditer(text):
        if _is_valid_tax_id("".join(match.groups())):
            confidence: SensitiveContentConfidence = (
                "certain"
                if _has_context(text, match.start(), _TAX_ID_CONTEXT_RE, 60)
                else "likely"
            )
            yield _hit("tax_id", "pii", confidence, match)


_MONTHS = (
    "januar|jänner|februar|märz|april|mai|juni|juli|august|september|oktober"
    "|november|dezember|january|february|march|may|june|july|october|december"
    "|jan|feb|mär|mar|apr|jun|jul|aug|sept|sep|okt|oct|nov|dez|dec"
)
_DATE_OF_BIRTH_RE = re.compile(
    r"(?i:\b(?:geb(?:oren)?\.?(?:\s+am)?|geburtsdatum|geb\.-datum"
    r"|date\s+of\s+birth|d\.?o\.?b\.?|born(?:\s+on)?))\s*:?\s*"
    r"(\d{1,2}\.\s?\d{1,2}\.\s?(?:19|20)?\d{2}\b"
    r"|(?:19|20)\d{2}-\d{2}-\d{2}\b"
    rf"|\d{{1,2}}\.?\s+(?i:{_MONTHS})\.?\s+(?:19|20)\d{{2}}\b)"
)


def detect_dates_of_birth(text: str, _options: ScanOptions) -> Iterator[Hit]:
    for match in _DATE_OF_BIRTH_RE.finditer(text):
        yield _hit("date_of_birth", "pii", "certain", match, 1)


_EMAIL_RE = re.compile(
    r"(?<![\w.+-])[A-Za-z0-9._%+-]{1,64}@([A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63})+)"
)


def _is_ignored_domain(domain: str, ignored: frozenset[str]) -> bool:
    domain = domain.lower()
    return any(domain == item or domain.endswith(f".{item}") for item in ignored)


def detect_emails(text: str, options: ScanOptions) -> Iterator[Hit]:
    for match in _EMAIL_RE.finditer(text):
        domain = match.group(1)
        tld = domain.rsplit(".", 1)[-1]
        if len(tld) < 2 or not tld.isalpha():
            continue
        if _is_ignored_domain(domain, options.ignored_email_domains):
            continue
        yield _hit("email", "pii", "certain", match)


_PHONE_RE = re.compile(
    # A spaced slash followed by a new phone prefix separates alternatives;
    # slashes within a single number ("089 / 23312345") remain supported.
    r"(?<![\w+/.,-])(?:\+\d|\(0|0)"
    r"(?:(?! +/ +(?:\+\d|\(0|0))[\d ()/-]){5,22}\d(?![\w/-])(?![.,]\d)"
)


def detect_phone_numbers(text: str, _options: ScanOptions) -> Iterator[Hit]:
    for match in _PHONE_RE.finditer(text):
        value = match.group(0)
        # Do not restart inside a grouped identifier such as an invalid IBAN.
        if value.startswith("0") and re.search(
            r"\d{4} $", text[max(0, match.start() - 5) : match.start()]
        ):
            continue
        digits = re.sub(r"\D", "", value)
        if 8 <= len(digits) <= 15 and len(set(digits)) > 2:
            yield _hit("phone", "pii", "likely", match)


DEFAULT_DETECTORS: tuple[Detector, ...] = (
    detect_private_keys,
    detect_jwts,
    detect_connection_strings,
    detect_access_tokens,
    detect_credential_assignments,
    detect_high_entropy_secrets,
    detect_id_documents,
    detect_social_security_numbers,
    detect_ibans,
    detect_credit_cards,
    detect_tax_ids,
    detect_dates_of_birth,
    detect_emails,
    detect_phone_numbers,
)
