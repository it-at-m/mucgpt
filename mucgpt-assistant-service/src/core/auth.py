import functools
import logging

import requests
from fastapi import Header, HTTPException
from joserfc import jwt
from joserfc.jwk import KeySet

from config.configuration import ConfigHelper

logger = logging.getLogger(__name__)


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
        except Exception as e:
            logger.error("Error fetching Openid-Config", e)
            raise e
        try:
            jwks_response = requests.get(
                url=jwks_uri, headers={"Accept": "application/json"}, timeout=5
            )
            jwks_response.raise_for_status()
        except Exception as e:
            logger.error("Error fetching JWKS", e)
            raise e
        resp = jwks_response.json()
        keyset = KeySet.import_key_set(resp)
        return keyset

    def authentificate(self, accesstoken):
        claims = self.decode(accesstoken)
        try:
            roles = self.getRoles(claims)
        except KeyError:
            raise AuthError(
                "Sie haben noch keinen Zugang zu MUCGPT freigeschalten.  Wie das geht, erfahren sie in im folgendem WILMA Artikel: https://wilma.muenchen.de/pages/it-steuerung-management/apps/wiki/kuenstliche-intelligenz/list/view/91f43afa-3315-478f-a9a4-7f50ae2a32f2.",
                status_code=401,
            )

        if self.role not in roles:
            raise AuthError(
                "Sie haben noch keinen Zugang zu MUCGPT freigeschalten.  Wie das geht, erfahren sie in im folgendem WILMA Artikel: https://wilma.muenchen.de/pages/it-steuerung-management/apps/wiki/kuenstliche-intelligenz/list/view/91f43afa-3315-478f-a9a4-7f50ae2a32f2.",
                status_code=401,
            )
        return claims

    def decode(self, token):
        if token is None:
            raise AuthError("Missing Authorization header", status_code=401)
        try:
            if token.lower().startswith("bearer "):
                token = token[7:]
            decoded = jwt.decode(
                token,
                key=self.get_jwks_data(),
            )
            return decoded.claims
        except Exception:
            raise AuthError(
                "Sie haben noch keinen Zugang zu MUCGPT freigeschalten.  Wie das geht, erfahren sie in im folgendem WILMA Artikel: https://wilma.muenchen.de/pages/it-steuerung-management/apps/wiki/kuenstliche-intelligenz/list/view/91f43afa-3315-478f-a9a4-7f50ae2a32f2.",
                status_code=401,
            )

    def getRoles(self, claims):
        return claims["resource_access"]["mucgpt"]["roles"]

    def getName(self, claims):
        return claims["name"]

    def getDepartment(self, claims):
        return str(claims["department"])


# Authentication dependency
def authenticate_user(access_token: str = Header(..., alias="authorization")):
    """Dependency to authenticate users based on access token."""

    # Load configuration
    config_helper = ConfigHelper()
    config = config_helper.loadData()

    # Initialize authentication helper
    auth_helper = AuthentificationHelper(
        issuer=config.backend.sso_config.sso_issuer, role=config.backend.sso_config.role
    )
    if not config.backend.enable_auth:
        # Return dummy claims when auth is disabled for development
        return {"name": "Development User", "department": "Dev"}

    try:
        claims = auth_helper.authentificate(access_token)
        return claims
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))
