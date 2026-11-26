"""Server-side image fetching restricted to the deployment link allowlist.

The export converters embed allowlisted-host images that the browser cannot
inline (no CORS headers on the deployment's own image hosts). The fetcher
enforces https, exact-host matching against `allowed_link_domains` — the same
allowlist that makes those hosts' links clickable — validates every redirect
hop, requires image content types and bounds the response size.
"""

from urllib.parse import urlparse

import httpx

from config.settings import get_settings
from core.logtools import getLogger

logger = getLogger(__name__)

_MAX_IMAGE_BYTES = 5 * 1024 * 1024
_MAX_REDIRECTS = 3
_FETCH_TIMEOUT_SECONDS = 10.0


def _host_allowed(url: str, hosts: list[str]) -> bool:
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port:
        return False
    return parsed.hostname in hosts


def fetch_allowed_image(
    url: str,
    *,
    transport: httpx.BaseTransport | None = None,
) -> tuple[bytes, str] | None:
    """Fetch an image from an allowlisted host.

    Returns the response bytes and content type, or None when the URL is not
    allowlisted, does not respond as an image within limits, or the request
    fails. Every redirect hop must stay allowlisted.
    """
    hosts = get_settings().allowed_link_domains
    if not _host_allowed(url, hosts):
        return None
    current = url
    try:
        with httpx.Client(
            timeout=_FETCH_TIMEOUT_SECONDS, transport=transport
        ) as client:
            for hop in range(_MAX_REDIRECTS + 1):
                if not _host_allowed(current, hosts):
                    return None
                response = client.get(current)
                if response.status_code in (301, 302, 303, 307, 308):
                    location = response.headers.get("location")
                    if location is None or hop == _MAX_REDIRECTS:
                        return None
                    current = str(response.url.join(location))
                    continue
                if response.status_code != 200:
                    return None
                content_type = (
                    response.headers.get("content-type", "")
                    .partition(";")[0]
                    .strip()
                    .lower()
                )
                if not content_type.startswith("image/"):
                    return None
                if len(response.content) > _MAX_IMAGE_BYTES:
                    return None
                return response.content, content_type
    except httpx.HTTPError:
        logger.info("Export image fetch failed for %s", url)
        return None
