import base64
import secrets
import time
from urllib.parse import urlencode, urljoin, urlparse

import httpx
from httpx import Auth, Request, Response
from mcp.client.auth.oauth2 import PKCEParameters, TokenStorage
from mcp.client.auth.utils import (
    build_oauth_authorization_server_metadata_discovery_urls,
    build_protected_resource_metadata_discovery_urls,
    create_client_registration_request,
    create_oauth_metadata_request,
    get_client_metadata_scopes,
    handle_auth_metadata_response,
    handle_protected_resource_response,
    handle_registration_response,
    handle_token_response_scopes,
)
from mcp.shared.auth import (
    OAuthClientInformationFull,
    OAuthClientMetadata,
    OAuthMetadata,
    OAuthToken,
    ProtectedResourceMetadata,
)
from mcp.shared.auth_utils import resource_url_from_server_url
from pydantic import BaseModel, SecretStr

from config.settings import AtlassianOAuthConfig, MCPSourceConfig
from core.cache import RedisCache


class AtlassianOAuthToken(BaseModel):
    access_token: SecretStr
    token_type: str = "Bearer"


class AtlassianOAuthState(BaseModel):
    state: str
    user_id: str
    source_id: str
    server_url: str
    redirect_uri: str
    code_verifier: str
    resource: str | None = None
    oauth_metadata: OAuthMetadata
    client_info: OAuthClientInformationFull
    created_at: float


class AtlassianOAuthConnection(BaseModel):
    tokens: OAuthToken
    client_info: OAuthClientInformationFull
    oauth_metadata: OAuthMetadata
    server_url: str
    resource: str | None = None
    expires_at: float | None = None


class AtlassianOAuthStart(BaseModel):
    authorization_url: str
    state: str


class AtlassianOAuthTokenStore(TokenStorage):
    _PREFIX = "atlassian_oauth"
    _CONNECTION_PREFIX = "atlassian_oauth_connection"
    _CLIENT_PREFIX = "atlassian_oauth_client"
    _STATE_PREFIX = "atlassian_oauth_state"
    _MCP_TOOLS_PREFIX = "mcp_tools"

    def __init__(self, user_id: str, source_id: str = "mcp-atlassian") -> None:
        self.user_id = user_id
        self.source_id = source_id

    @staticmethod
    def _legacy_key(user_id: str) -> str:
        return f"{AtlassianOAuthTokenStore._PREFIX}:{user_id}"

    @staticmethod
    def _token_key(user_id: str, source_id: str) -> str:
        return f"{AtlassianOAuthTokenStore._PREFIX}:{user_id}:{source_id}"

    @staticmethod
    def _connection_key(user_id: str, source_id: str) -> str:
        return f"{AtlassianOAuthTokenStore._CONNECTION_PREFIX}:{user_id}:{source_id}"

    @staticmethod
    def _client_key(user_id: str, source_id: str) -> str:
        return f"{AtlassianOAuthTokenStore._CLIENT_PREFIX}:{user_id}:{source_id}"

    @staticmethod
    def _state_key(state: str) -> str:
        return f"{AtlassianOAuthTokenStore._STATE_PREFIX}:{state}"

    @staticmethod
    def _tools_key(user_id: str) -> str:
        return f"{AtlassianOAuthTokenStore._MCP_TOOLS_PREFIX}:{user_id}"

    async def get_tokens(self) -> OAuthToken | None:
        connection = await RedisCache.get_object(
            AtlassianOAuthTokenStore._connection_key(self.user_id, self.source_id)
        )
        if isinstance(connection, AtlassianOAuthConnection):
            return connection.tokens
        return await RedisCache.get_object(
            AtlassianOAuthTokenStore._token_key(self.user_id, self.source_id)
        )

    async def set_tokens(self, tokens: OAuthToken) -> None:
        connection = await self.get_connection()
        if connection:
            connection.tokens = tokens
            connection.expires_at = _calculate_expires_at(tokens)
            await self.set_connection(connection)
            return

        await RedisCache.set_object(
            key=AtlassianOAuthTokenStore._token_key(self.user_id, self.source_id),
            obj=tokens,
        )
        await AtlassianOAuthTokenStore.invalidate_mcp_tool_cache(self.user_id)

    async def get_connection(self) -> AtlassianOAuthConnection | None:
        return await RedisCache.get_object(
            AtlassianOAuthTokenStore._connection_key(self.user_id, self.source_id)
        )

    async def set_connection(self, connection: AtlassianOAuthConnection) -> None:
        await RedisCache.set_object(
            key=AtlassianOAuthTokenStore._connection_key(self.user_id, self.source_id),
            obj=connection,
        )
        await self.set_client_info(connection.client_info)
        await AtlassianOAuthTokenStore.invalidate_mcp_tool_cache(self.user_id)

    async def get_client_info(self) -> OAuthClientInformationFull | None:
        return await RedisCache.get_object(
            AtlassianOAuthTokenStore._client_key(self.user_id, self.source_id)
        )

    async def set_client_info(self, client_info: OAuthClientInformationFull) -> None:
        await RedisCache.set_object(
            key=AtlassianOAuthTokenStore._client_key(self.user_id, self.source_id),
            obj=client_info,
        )

    @staticmethod
    async def get_token(
        user_id: str, source_id: str = "mcp-atlassian"
    ) -> AtlassianOAuthToken | None:
        tokens = await RedisCache.get_object(
            AtlassianOAuthTokenStore._token_key(user_id, source_id)
        )
        if isinstance(tokens, OAuthToken):
            return AtlassianOAuthToken(
                access_token=SecretStr(tokens.access_token),
                token_type=tokens.token_type,
            )
        return await RedisCache.get_object(AtlassianOAuthTokenStore._legacy_key(user_id))

    @staticmethod
    async def set_token(
        user_id: str,
        access_token: SecretStr,
        token_type: str = "Bearer",
        ttl: int | None = None,
        source_id: str = "mcp-atlassian",
    ) -> None:
        tokens = OAuthToken(
            access_token=access_token.get_secret_value(),
            token_type=token_type,
            expires_in=ttl,
        )
        await AtlassianOAuthTokenStore(user_id, source_id).set_tokens(tokens)

    @staticmethod
    async def delete_token(
        user_id: str, source_id: str = "mcp-atlassian"
    ) -> None:
        redis = await RedisCache.get_redis()
        await redis.delete(
            AtlassianOAuthTokenStore._legacy_key(user_id),
            AtlassianOAuthTokenStore._token_key(user_id, source_id),
            AtlassianOAuthTokenStore._connection_key(user_id, source_id),
            AtlassianOAuthTokenStore._client_key(user_id, source_id),
        )
        await AtlassianOAuthTokenStore.invalidate_mcp_tool_cache(user_id)

    @staticmethod
    async def has_token(
        user_id: str, source_id: str = "mcp-atlassian"
    ) -> bool:
        redis = await RedisCache.get_redis()
        exists = await redis.exists(
            AtlassianOAuthTokenStore._connection_key(user_id, source_id)
        )
        if exists:
            return True
        token_exists = await redis.exists(
            AtlassianOAuthTokenStore._token_key(user_id, source_id)
        )
        if token_exists:
            return True
        legacy_exists = await redis.exists(AtlassianOAuthTokenStore._legacy_key(user_id))
        return bool(legacy_exists)

    @staticmethod
    async def invalidate_mcp_tool_cache(user_id: str) -> None:
        redis = await RedisCache.get_redis()
        await redis.delete(AtlassianOAuthTokenStore._tools_key(user_id))

    @staticmethod
    async def set_state(state: AtlassianOAuthState, ttl: int = 10 * 60) -> None:
        await RedisCache.set_object(
            key=AtlassianOAuthTokenStore._state_key(state.state),
            obj=state,
            ttl=ttl,
        )

    @staticmethod
    async def pop_state(state: str) -> AtlassianOAuthState | None:
        key = AtlassianOAuthTokenStore._state_key(state)
        redis = await RedisCache.get_redis()
        state_obj = await RedisCache.get_object(key)
        await redis.delete(key)
        return state_obj


async def start_atlassian_oauth_flow(
    user_id: str,
    source_id: str,
    source_cfg: MCPSourceConfig,
    redirect_uri: str,
    oauth_cfg: AtlassianOAuthConfig,
) -> AtlassianOAuthStart:
    protected_resource_metadata, oauth_metadata = await _discover_oauth_metadata(
        server_url=source_cfg.url,
        timeout=oauth_cfg.REQUEST_TIMEOUT,
    )
    scope = get_client_metadata_scopes(
        None,
        protected_resource_metadata,
        oauth_metadata,
    )
    client_metadata = OAuthClientMetadata(
        redirect_uris=[redirect_uri],
        client_name=oauth_cfg.CLIENT_NAME,
        scope=scope,
    )
    client_info = await _register_client(
        server_url=source_cfg.url,
        oauth_metadata=oauth_metadata,
        client_metadata=client_metadata,
        timeout=oauth_cfg.REQUEST_TIMEOUT,
    )
    await AtlassianOAuthTokenStore(user_id, source_id).set_client_info(client_info)

    pkce = PKCEParameters.generate()
    state = secrets.token_urlsafe(32)
    resource = _get_resource(source_cfg.url, protected_resource_metadata)
    authorization_url = _build_authorization_url(
        oauth_metadata=oauth_metadata,
        client_info=client_info,
        redirect_uri=redirect_uri,
        state=state,
        code_challenge=pkce.code_challenge,
        scope=scope,
        resource=resource,
    )
    await AtlassianOAuthTokenStore.set_state(
        AtlassianOAuthState(
            state=state,
            user_id=user_id,
            source_id=source_id,
            server_url=source_cfg.url,
            redirect_uri=redirect_uri,
            code_verifier=pkce.code_verifier,
            resource=resource,
            oauth_metadata=oauth_metadata,
            client_info=client_info,
            created_at=time.time(),
        )
    )
    return AtlassianOAuthStart(authorization_url=authorization_url, state=state)


async def complete_atlassian_oauth_flow(code: str, state: str) -> str:
    flow_state = await AtlassianOAuthTokenStore.pop_state(state)
    if flow_state is None:
        raise ValueError("Unknown or expired OAuth state")

    token_url = str(flow_state.oauth_metadata.token_endpoint)
    token_data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": flow_state.redirect_uri,
        "client_id": flow_state.client_info.client_id or "",
        "code_verifier": flow_state.code_verifier,
    }
    if flow_state.resource:
        token_data["resource"] = flow_state.resource

    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    token_data, headers = _prepare_token_auth(
        token_data,
        headers,
        flow_state.client_info,
    )
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(token_url, data=token_data, headers=headers)

    if response.status_code != 200:
        raise ValueError(f"Token exchange failed with status {response.status_code}")

    tokens = await handle_token_response_scopes(response)
    storage = AtlassianOAuthTokenStore(flow_state.user_id, flow_state.source_id)
    await storage.set_tokens(tokens)
    await storage.set_connection(
        AtlassianOAuthConnection(
            tokens=tokens,
            client_info=flow_state.client_info,
            oauth_metadata=flow_state.oauth_metadata,
            server_url=flow_state.server_url,
            resource=flow_state.resource,
            expires_at=_calculate_expires_at(tokens),
        )
    )
    return flow_state.user_id


class AtlassianOAuthHttpAuth(Auth):
    """HTTPX auth provider that injects and refreshes stored Atlassian OAuth tokens."""

    requires_response_body = True

    def __init__(self, user_id: str, source_id: str) -> None:
        self.user_id = user_id
        self.source_id = source_id

    async def async_auth_flow(self, request: Request):
        token = await get_valid_atlassian_access_token(self.user_id, self.source_id)
        if token:
            request.headers["Authorization"] = f"Bearer {token}"

        response: Response = yield request
        if response.status_code != 401:
            return

        refreshed = await refresh_atlassian_connection(self.user_id, self.source_id)
        if not refreshed:
            return

        request.headers["Authorization"] = f"Bearer {refreshed}"
        yield request


async def get_valid_atlassian_access_token(
    user_id: str,
    source_id: str,
) -> str | None:
    storage = AtlassianOAuthTokenStore(user_id, source_id)
    connection = await storage.get_connection()
    if connection:
        if _token_is_expiring(connection) and connection.tokens.refresh_token:
            refreshed = await refresh_atlassian_connection(user_id, source_id)
            if refreshed:
                return refreshed
        return connection.tokens.access_token

    token = await storage.get_tokens()
    if token:
        return token.access_token

    legacy_token = await AtlassianOAuthTokenStore.get_token(user_id, source_id)
    if legacy_token:
        return legacy_token.access_token.get_secret_value()

    return None


async def refresh_atlassian_connection(
    user_id: str,
    source_id: str,
) -> str | None:
    storage = AtlassianOAuthTokenStore(user_id, source_id)
    connection = await storage.get_connection()
    if not connection or not connection.tokens.refresh_token:
        return None

    token_data = {
        "grant_type": "refresh_token",
        "refresh_token": connection.tokens.refresh_token,
        "client_id": connection.client_info.client_id or "",
    }
    if connection.resource:
        token_data["resource"] = connection.resource

    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    token_data, headers = _prepare_token_auth(
        token_data,
        headers,
        connection.client_info,
    )
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            str(connection.oauth_metadata.token_endpoint),
            data=token_data,
            headers=headers,
        )

    if response.status_code != 200:
        return None

    tokens = await handle_token_response_scopes(response)
    connection.tokens = tokens
    connection.expires_at = _calculate_expires_at(tokens)
    await storage.set_connection(connection)
    return tokens.access_token


async def _discover_oauth_metadata(
    server_url: str,
    timeout: float,
) -> tuple[ProtectedResourceMetadata | None, OAuthMetadata]:
    protected_resource_metadata = None

    async with httpx.AsyncClient(timeout=timeout) as client:
        prm_urls = build_protected_resource_metadata_discovery_urls(None, server_url)
        for url in prm_urls:
            request = create_oauth_metadata_request(url)
            response = await client.send(request)
            protected_resource_metadata = await handle_protected_resource_response(
                response
            )
            if protected_resource_metadata:
                break

        auth_server_url = (
            str(protected_resource_metadata.authorization_servers[0])
            if protected_resource_metadata
            and protected_resource_metadata.authorization_servers
            else None
        )
        asm_urls = build_oauth_authorization_server_metadata_discovery_urls(
            auth_server_url,
            server_url,
        )
        for url in asm_urls:
            request = create_oauth_metadata_request(url)
            response = await client.send(request)
            ok, metadata = await handle_auth_metadata_response(response)
            if metadata:
                return protected_resource_metadata, metadata
            if not ok:
                break

    raise ValueError("Unable to discover Atlassian OAuth metadata")


async def _register_client(
    server_url: str,
    oauth_metadata: OAuthMetadata,
    client_metadata: OAuthClientMetadata,
    timeout: float,
) -> OAuthClientInformationFull:
    registration_request = create_client_registration_request(
        oauth_metadata,
        client_metadata,
        _authorization_base_url(server_url),
    )
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.send(registration_request)
    return await handle_registration_response(response)


def _build_authorization_url(
    oauth_metadata: OAuthMetadata,
    client_info: OAuthClientInformationFull,
    redirect_uri: str,
    state: str,
    code_challenge: str,
    scope: str | None,
    resource: str | None,
) -> str:
    params = {
        "response_type": "code",
        "client_id": client_info.client_id or "",
        "redirect_uri": redirect_uri,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    if scope:
        params["scope"] = scope
    if resource:
        params["resource"] = resource
    return f"{oauth_metadata.authorization_endpoint}?{urlencode(params)}"


def _prepare_token_auth(
    data: dict[str, str],
    headers: dict[str, str],
    client_info: OAuthClientInformationFull,
) -> tuple[dict[str, str], dict[str, str]]:
    auth_method = client_info.token_endpoint_auth_method
    if (
        auth_method == "client_secret_basic"
        and client_info.client_id
        and client_info.client_secret
    ):
        credentials = f"{client_info.client_id}:{client_info.client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        headers["Authorization"] = f"Basic {encoded_credentials}"
    elif auth_method == "client_secret_post" and client_info.client_secret:
        data["client_secret"] = client_info.client_secret
    return data, headers


def _authorization_base_url(server_url: str) -> str:
    parsed = urlparse(server_url)
    return f"{parsed.scheme}://{parsed.netloc}"


def _get_resource(
    server_url: str,
    protected_resource_metadata: ProtectedResourceMetadata | None,
) -> str:
    if protected_resource_metadata and protected_resource_metadata.resource:
        return str(protected_resource_metadata.resource)
    return resource_url_from_server_url(server_url)


def _calculate_expires_at(tokens: OAuthToken) -> float | None:
    if tokens.expires_in is None:
        return None
    return time.time() + tokens.expires_in


def _token_is_expiring(connection: AtlassianOAuthConnection) -> bool:
    if connection.expires_at is None:
        return False
    return time.time() >= connection.expires_at - 60


def build_atlassian_redirect_uri(
    callback_path: str,
    redirect_base_url: str | None,
) -> str:
    if redirect_base_url:
        return urljoin(redirect_base_url.rstrip("/") + "/", callback_path.lstrip("/"))
    return callback_path
