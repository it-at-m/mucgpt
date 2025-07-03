import functools

import requests
from fastapi import Depends, Header, HTTPException
from joserfc import jwt
from joserfc.jwk import KeySet

from config.settings import Settings, get_settings
from core.auth_models import AuthenticationResult
from core.logtools import getLogger

logger = getLogger("mucgpt-assistant-service")


class AuthError(Exception):
    def __init__(self, error, status_code):
        self.error = error
        self.status_code = status_code


class AuthentificationHelper:
    """Authentificates against an OpenID Connect provider.
    Looks if the right role is available.
    """

    def __init__(self, issuer: str, role: str):
        self.issuer = issuer
        self.role = role

    @functools.lru_cache(maxsize=None)
    def get_jwks_data(self):
        logger.debug(f"Fetching OIDC configuration from {self.issuer}")
        openid_configuration_endpoint = (
            f"{self.issuer}/.well-known/openid-configuration"
        )
        resp = requests.get(
            url=openid_configuration_endpoint,
            headers={"Accept": "application/json"},
            timeout=5,
        )
        resp.raise_for_status()
        try:
            jwks_uri = resp.json()["jwks_uri"]
            logger.debug(f"Retrieved JWKS URI: {jwks_uri}")
        except Exception as e:
            logger.error("Error fetching Openid-Config", exc_info=e)
            raise e

        try:
            logger.debug("Fetching JWKS from URI")
            jwks_response = requests.get(
                url=jwks_uri, headers={"Accept": "application/json"}, timeout=5
            )
            jwks_response.raise_for_status()
        except Exception as e:
            logger.error("Error fetching JWKS", exc_info=e)
            raise e

        resp = jwks_response.json()
        keyset = KeySet.import_key_set(resp)
        logger.debug("Successfully fetched and parsed JWKS data")
        return keyset

    def authentificate(self, accesstoken) -> AuthenticationResult:
        """Authenticates the user based on the access token.
        Checks if the user has the required role.
        Returns an AuthenticationResult if authenticated.
        Raises AuthError if the user is not authenticated or does not have the required role.
        """
        logger.debug("Starting authentication process")
        claims = self.decode(accesstoken)
        try:
            roles = self.getRoles(claims)
            logger.debug(f"User roles: {roles}")
        except KeyError:
            logger.warning("Authentication failed: No roles found in token")
            raise AuthError(
                "Sie haben noch keinen Zugang zu MUCGPT freigeschalten.  Wie das geht, erfahren sie in im folgendem WILMA Artikel: https://wilma.muenchen.de/pages/it-steuerung-management/apps/wiki/kuenstliche-intelligenz/list/view/91f43afa-3315-478f-a9a4-7f50ae2a32f2.",
                status_code=401,
            )

        if self.role not in roles:
            logger.warning(
                f"Authentication failed: Required role '{self.role}' not found in user roles"
            )
            raise AuthError(
                "Sie haben noch keinen Zugang zu MUCGPT freigeschalten.  Wie das geht, erfahren sie in im folgendem WILMA Artikel: https://wilma.muenchen.de/pages/it-steuerung-management/apps/wiki/kuenstliche-intelligenz/list/view/91f43afa-3315-478f-a9a4-7f50ae2a32f2.",
                status_code=401,
            )

        return AuthenticationResult(
            lhm_object_id=self.getLHMObjectID(claims),
            department=self.getDepartment(claims),
            name=self.getName(claims),
            roles=roles,
        )

    def decode(self, token):
        if token is None:
            logger.warning("Authentication failed: Missing Authorization header")
            raise AuthError("Missing Authorization header", status_code=401)
        try:
            if token.lower().startswith("bearer "):
                token = token[7:]
            logger.debug("Decoding JWT token")
            decoded = jwt.decode(
                token,
                key=self.get_jwks_data(),
            )
            logger.debug("JWT token successfully decoded")
            return decoded.claims
        except Exception as e:
            logger.warning("Authentication failed: Invalid token", exc_info=e)
            raise AuthError(
                "Sie haben noch keinen Zugang zu MUCGPT freigeschalten.  Wie das geht, erfahren sie in im folgendem WILMA Artikel: https://wilma.muenchen.de/pages/it-steuerung-management/apps/wiki/kuenstliche-intelligenz/list/view/91f43afa-3315-478f-a9a4-7f50ae2a32f2.",
                status_code=401,
            )

    def getRoles(self, claims):
        logger.debug("Extracting roles from claims")
        return claims["resource_access"]["mucgpt"]["roles"]

    def getName(self, claims):
        logger.debug("Extracting name from claims")
        return claims["name"]

    def getDepartment(self, claims):
        logger.debug("Extracting department from claims")
        return str(claims["department"])

    def getLHMObjectID(self, claims):
        """Get the LHM Objekt ID from the claims."""
        logger.debug("Extracting LHM Object ID from claims")
        return str(claims.get("lhmobjektID", ""))


# Authentication dependency for FastAPI
def authenticate_user(
    authorization: str = Header(...),
    settings: Settings = Depends(get_settings),
) -> AuthenticationResult:
    """Dependency to authenticate users based on access token."""  # Load configuration
    logger.debug("Loading configuration for authentication")
    if not settings.MUCGPT_ASSISTANT_ENABLE_AUTH:
        logger.info("Authentication disabled, using guest account")
        return AuthenticationResult(
            lhm_object_id="guest",
            department="guest",
            name="Guest User",
            roles=[settings.MUCGPT_ASSISTANT_SSO_ROLE],
        )  # Initialize authentication helper
    logger.debug("Initializing authentication helper")
    auth_helper = AuthentificationHelper(
        issuer=settings.MUCGPT_ASSISTANT_SSO_ISSUER,
        role=settings.MUCGPT_ASSISTANT_SSO_ROLE,
    )

    try:
        logger.info("Authenticating user")
        user_info = auth_helper.authentificate(authorization)
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
