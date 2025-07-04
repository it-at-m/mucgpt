import requests
from fastapi import Depends, Header, HTTPException

from config.settings import Settings, get_settings
from core.auth_models import AuthenticationResult, AuthError
from core.logtools import getLogger

logger = getLogger("mucgpt-core")


ACCESS_DENIED_MESSAGE = "Sie haben noch keinen Zugang zu MUCGPT freigeschalten.  Wie das geht, erfahren sie in im folgendem WILMA Artikel: https://wilma.muenchen.de/pages/it-steuerung-management/apps/wiki/kuenstliche-intelligenz/list/view/91f43afa-3315-478f-a9a4-7f50ae2a32f2."
ROLE_PREFIX = "ROLE_"


class AuthenticationHelper:
    """Authenticates against an OpenID Connect provider."""

    def __init__(self, userinfo_url: str, role: str):
        self.userinfo_url = userinfo_url
        self.role = role

    def get_user_info(self, accesstoken: str) -> dict:
        """Gets user info from the userinfo endpoint.

        Args:
            accesstoken: The access token to use for authentication

        Returns:
            dict: The user info from the userinfo endpoint

        Raises:
            AuthError: If the user info could not be fetched
        """
        logger.debug(f"Fetching user info from {self.userinfo_url}")
        # Make sure the token is properly formatted with "Bearer" prefix
        auth_header = (
            accesstoken
            if accesstoken.startswith("Bearer ")
            else f"Bearer {accesstoken}"
        )

        logger.debug(f"Using authorization header: {auth_header[:15]}...")

        try:
            resp = requests.get(
                url=self.userinfo_url,
                headers={"Authorization": auth_header, "Accept": "application/json"},
                timeout=5,
                allow_redirects=False,  # Don't follow redirects to prevent getting login page
            )

            logger.debug(f"User info response status: {resp.status_code}")
            logger.debug(f"User info response headers: {resp.headers}")

            if resp.status_code in [301, 302, 303, 307, 308]:
                logger.error(
                    f"Redirect detected to {resp.headers.get('Location')}. This suggests authentication issues."
                )
                raise AuthError(
                    "Authentication token is invalid or expired. Please login again.",
                    status_code=401,
                )

            resp.raise_for_status()

            # Check if response is HTML (login page) instead of JSON
            content_type = resp.headers.get("Content-Type", "")
            if (
                "html" in content_type
                or resp.text.strip().startswith("<!DOCTYPE html>")
                or "<html" in resp.text
            ):
                logger.error(
                    f"Received HTML instead of JSON. Content-Type: {content_type}"
                )
                raise AuthError(
                    "Authentication service returned HTML instead of user info. Your session may have expired.",
                    status_code=401,
                )

            try:
                return resp.json()
            except requests.exceptions.JSONDecodeError as e:
                logger.error(f"Failed to decode JSON response: {e}")
                logger.debug(f"Response content (first 500 chars): {resp.text[:500]}")
                raise AuthError("Invalid response from authentication service.", 500)

        except requests.exceptions.RequestException as e:
            logger.error("Error fetching user info", exc_info=e)
            if e.response is not None and e.response.status_code in [401, 403]:
                raise AuthError(
                    ACCESS_DENIED_MESSAGE,
                    status_code=e.response.status_code,
                )
            raise AuthError("Could not connect to authentication service.", 500)

    def authenticate(self, accesstoken: str) -> AuthenticationResult:
        """Authenticates the user based on the access token.
        Checks if the user has the required role.
        Returns an AuthenticationResult if authenticated.
        Raises AuthError if the user is not authenticated or does not have the required role.
        """
        logger.debug("Starting authentication process")
        if accesstoken is None:
            logger.warning("Authentication failed: Missing Authorization header")
            raise AuthError("Missing Authorization header", status_code=401)

        user_info = self.get_user_info(accesstoken)
        logger.debug(f"user_info: {user_info}")

        try:
            roles = self.getRoles(user_info)
            logger.debug(f"User roles: {roles}")
        except KeyError:
            logger.warning("Authentication failed: No roles found in token")
            raise AuthError(
                ACCESS_DENIED_MESSAGE,
                status_code=401,
            )

        if self.role not in roles:
            logger.warning(
                f"Authentication failed: Required role '{self.role}' not found in user roles"
            )
            raise AuthError(
                ACCESS_DENIED_MESSAGE,
                status_code=401,
            )

        return AuthenticationResult(
            lhm_object_id=self.getLHMObjectID(user_info),
            department=self.getDepartment(user_info),
            name=self.getName(user_info),
            roles=roles,
        )

    def getRoles(self, userinfo: dict) -> list[str]:
        logger.debug("Extracting roles from userinfo")
        # Map 'authorities' like ['ROLE_lhm-ab-mucgpt-user'] to role names
        authorities = userinfo.get("authorities", [])
        roles = []
        for auth in authorities:
            if auth.startswith(ROLE_PREFIX):
                roles.append(auth[len(ROLE_PREFIX) :])  # Remove 'ROLE_' prefix
            else:
                roles.append(auth)
        return roles

    def getName(self, userinfo: dict) -> str:
        logger.debug("Extracting name from userinfo")
        return userinfo.get("name", "")

    def getDepartment(self, userinfo: dict) -> str:
        logger.debug("Extracting department from userinfo")
        return str(userinfo.get("department", ""))

    def getLHMObjectID(self, userinfo: dict) -> str:
        """Get the LHM Object ID from the userinfo."""
        logger.debug("Extracting LHM Object ID from userinfo")
        return str(userinfo.get("lhmObjectID", ""))


# Authentication dependency for FastAPI
def authenticate_user(
    authorization: str = Header(...),
    settings: Settings = Depends(get_settings),
) -> AuthenticationResult:
    """Dependency to authenticate users based on access token."""  # Load configuration
    logger.debug("Loading configuration for authentication")
    if not settings.backend.enable_auth:
        logger.info("Authentication disabled, using guest account")
        return AuthenticationResult(
            lhm_object_id="guest",
            department="guest",
            name="Guest User",
            roles=[settings.SSO_ROLE],
        )
    auth_helper = AuthenticationHelper(
        userinfo_url=settings.backend.sso_config.sso_userinfo_url,
        role=settings.backend.sso_config.role,
    )

    try:
        logger.info("Authenticating user")
        user_info = auth_helper.authenticate(authorization)
        logger.info(
            f"User authenticated successfully: {user_info.name} from {user_info.department}"
        )
        return user_info
    except AuthError as e:
        logger.error(f"Authentication failed: {e.error}")
        raise HTTPException(status_code=e.status_code, detail=e.error)
    except Exception as e:
        logger.error("Authentication failed", exc_info=e)
        raise HTTPException(status_code=401, detail="Authentication failed")
