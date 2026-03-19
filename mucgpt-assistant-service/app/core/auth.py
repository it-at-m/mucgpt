import base64
import json

from fastapi import Depends, Header, HTTPException

from config.settings import SSOSettings, get_sso_settings
from core.auth_models import AuthenticationResult, AuthError
from core.logtools import getLogger

logger = getLogger("mucgpt-assistant-service")


ACCESS_DENIED_MESSAGE = "Sie haben noch keinen Zugang zu MUCGPT freigeschaltet. Wie das geht, erfahren Sie im folgenden WILMA-Artikel: https://wilma.muenchen.de/pages/it-steuerung-management/apps/wiki/kuenstliche-intelligenz/list/view/91f43afa-3315-478f-a9a4-7f50ae2a32f2."
ROLE_PREFIX = "ROLE_"


class AuthenticationHelper:
    """Authenticates by parsing JWT access tokens directly."""

    def __init__(self, role: str):
        self.role = role

    def parse_jwt_payload(self, token: str) -> dict:
        """Parse JWT token and extract payload.

        Args:
            token: The JWT access token

        Returns:
            dict: The decoded JWT payload

        Raises:
            AuthError: If the token cannot be parsed
        """
        try:
            # Remove 'Bearer ' prefix if present
            if token.startswith("Bearer "):
                token = token[7:]

            # JWT tokens have 3 parts separated by dots: header.payload.signature
            parts = token.split(".")
            if len(parts) != 3:
                raise AuthError("Invalid JWT token format", status_code=401)

            # Decode the payload (second part)
            payload = parts[1]
            # Add padding if needed for base64 decoding
            padding = len(payload) % 4
            if padding:
                payload += "=" * (4 - padding)

            decoded_bytes = base64.urlsafe_b64decode(payload)
            payload_dict = json.loads(decoded_bytes.decode("utf-8"))

            return payload_dict

        except (ValueError, json.JSONDecodeError) as e:
            logger.error(f"Failed to parse JWT token: {e}")
            raise AuthError("Invalid JWT token", status_code=401)

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

        token_payload = self.parse_jwt_payload(accesstoken)
        logger.debug(f"token_payload: {token_payload}")

        try:
            roles = self.getRoles(token_payload)
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
            user_id=self.getLHMObjectID(token_payload),
            department=self.getDepartment(token_payload),
            name=self.getName(token_payload),
            roles=roles,
        )

    def getRoles(self, token_payload: dict) -> list[str]:
        logger.debug("Extracting roles from token payload")
        # Extract roles from resource_access.mucgpt.roles structure
        resource_access = token_payload.get("resource_access", {})
        mucgpt_access = resource_access.get("mucgpt", {})
        roles = mucgpt_access.get("roles", [])

        # Also check for authorities in case they exist in the token
        authorities = token_payload.get("authorities", [])
        for auth in authorities:
            if auth.startswith(ROLE_PREFIX):
                roles.append(auth[len(ROLE_PREFIX) :])  # Remove 'ROLE_' prefix
            else:
                roles.append(auth)

        return roles

    def getName(self, token_payload: dict) -> str:
        logger.debug("Extracting name from token payload")
        # Use givenname from token, fallback to other common JWT claims
        given_name = token_payload.get("givenname", "")
        if given_name:
            return given_name
        return (
            token_payload.get("name", "")
            or token_payload.get("preferred_username", "")
            or token_payload.get("given_name", "")
        ).strip()

    def getDepartment(self, token_payload: dict) -> str:
        logger.debug("Extracting department from token payload")
        return str(token_payload.get("department", ""))

    def getEmail(self, token_payload: dict) -> str:
        logger.debug("Extracting email from token payload")
        return str(token_payload.get("email", ""))

    def getUsername(self, token_payload: dict) -> str:
        logger.debug("Extracting username from token payload")
        return str(token_payload.get("username", ""))

    def getLHMObjectID(self, token_payload: dict) -> str:
        """Get the LHM Object ID from the token payload."""
        logger.debug("Extracting LHM Object ID from token payload")
        return str(token_payload.get("lhmObjectID", "") or token_payload.get("sub", ""))


# Authentication dependency for FastAPI
def authenticate_user(
    authorization: str = Header(...),
    sso_settings: SSOSettings = Depends(get_sso_settings),
) -> AuthenticationResult:
    """Dependency to authenticate users based on access token."""  # Load configuration
    logger.debug("Loading configuration for authentication")
    auth_helper = AuthenticationHelper(
        role=sso_settings.ROLE,
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
