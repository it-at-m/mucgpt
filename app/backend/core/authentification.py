import functools
import requests
from joserfc import jwt
from joserfc.jwk import KeySet

class AuthError(Exception):
    def __init__(self, error, status_code):
        self.error = error
        self.status_code = status_code

class AuthentificationHelper:
    def __init__(self, issuer: str, role: str):
        self.issuer = issuer
        self.role = role


    @functools.lru_cache(maxsize=None)
    def get_jwks_data(self, issuer: str):
        openid_configuration_endpoint = f'{issuer}/.well-known/openid-configuration'
        resp = requests.get(url= openid_configuration_endpoint,  headers={"Accept": "application/json"})
        try:
            jwks_uri = resp.json()['jwks_uri']
        except Exception as e:
            print("Error fetching Openid-Config", e)
            raise e
        try:
            jwks_response = requests.get(url=jwks_uri, headers={"Accept": "application/json"})
        except Exception as e:
            print("Error fetching JWKS", e)
            raise e
        resp =  jwks_response.json()
        keyset = KeySet.import_key_set(resp)
        return keyset

    def authentificate(self, accesstoken):
        claims = self.decode(accesstoken)
        try:
            roles = claims["resource_access"]['mucgpt']['roles']
        except KeyError:
            raise AuthError("Rolle nicht vorhanden", status_code=401)

        if self.role not in roles:
            raise AuthError("Rolle nicht vorhanden", status_code=401)
        return claims;
    
    def decode(self, token):
        keyset = self.get_jwks_data(self.issuer)
        decoded = jwt.decode(token, key=keyset)
        return decoded.claims

    def getRoles(self, claims):
        return claims["resource_access"]['mucgpt']['roles']

    def getName(self, claims):
        return claims['name']
    
    def getDepartment(self, claims):
        return str(claims['department'])
    