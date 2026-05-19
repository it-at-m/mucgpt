from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse

from api.api_models import (
    AtlassianConnectionStatus,
    AtlassianConnectResponse,
    AtlassianTokenRequest,
)
from config.settings import MCPSourceConfig, Settings, get_settings
from core.atlassian_oauth import (
    AtlassianOAuthTokenStore,
    build_atlassian_redirect_uri,
    complete_atlassian_oauth_flow,
    start_atlassian_oauth_flow,
)
from core.auth import authenticate_user
from core.auth_models import AuthenticationResult

router = APIRouter(prefix="/v1/integrations", tags=["Integrations"])

AuthenticatedUser = Annotated[AuthenticationResult, Depends(authenticate_user)]


def _get_atlassian_source(settings: Settings) -> tuple[str, MCPSourceConfig]:
    sources = settings.MCP.SOURCES or {}
    for source_id, source_cfg in sources.items():
        if source_cfg.atlassian_oauth:
            return source_id, source_cfg
    raise HTTPException(
        status_code=404,
        detail="No MCP source with atlassian_oauth=true is configured.",
    )


def _callback_url(request: Request, settings: Settings) -> str:
    callback_url = str(request.url_for("atlassian_oauth_callback"))
    if settings.ATLASSIAN_OAUTH.REDIRECT_BASE_URL:
        return build_atlassian_redirect_uri(
            "/api/backend/v1/integrations/atlassian/callback",
            settings.ATLASSIAN_OAUTH.REDIRECT_BASE_URL,
        )
    return callback_url


@router.get("/atlassian/status")
async def get_atlassian_status(
    user_info: AuthenticatedUser,
    settings: Annotated[Settings, Depends(get_settings)],
) -> AtlassianConnectionStatus:
    source_id, _ = _get_atlassian_source(settings)
    connected = await AtlassianOAuthTokenStore.has_token(user_info.user_id, source_id)
    return AtlassianConnectionStatus(connected=connected)


@router.get("/atlassian/connect")
async def connect_atlassian(
    request: Request,
    user_info: AuthenticatedUser,
    settings: Annotated[Settings, Depends(get_settings)],
) -> AtlassianConnectResponse:
    source_id, source_cfg = _get_atlassian_source(settings)
    oauth_start = await start_atlassian_oauth_flow(
        user_id=user_info.user_id,
        source_id=source_id,
        source_cfg=source_cfg,
        redirect_uri=_callback_url(request, settings),
        oauth_cfg=settings.ATLASSIAN_OAUTH,
    )
    return AtlassianConnectResponse(
        authorization_url=oauth_start.authorization_url,
        state=oauth_start.state,
    )


@router.get("/atlassian/authorize")
async def authorize_atlassian(
    request: Request,
    user_info: AuthenticatedUser,
    settings: Annotated[Settings, Depends(get_settings)],
) -> RedirectResponse:
    oauth_start = await connect_atlassian(request, user_info, settings)
    return RedirectResponse(oauth_start.authorization_url)


@router.get(
    "/atlassian/callback",
    name="atlassian_oauth_callback",
    response_model=None,
)
async def atlassian_oauth_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    settings: Settings = Depends(get_settings),
):
    if error:
        raise HTTPException(
            status_code=400,
            detail=error_description or error,
        )
    if not code or not state:
        raise HTTPException(status_code=400, detail="Missing OAuth code or state.")

    await complete_atlassian_oauth_flow(code=code, state=state)
    if settings.ATLASSIAN_OAUTH.SUCCESS_REDIRECT_URL:
        return RedirectResponse(settings.ATLASSIAN_OAUTH.SUCCESS_REDIRECT_URL)

    return HTMLResponse(
        """
        <!doctype html>
        <html>
          <head><title>Atlassian connected</title></head>
          <body>
            <h1>Atlassian connected</h1>
            <p>You can close this tab and return to MUCGPT.</p>
          </body>
        </html>
        """
    )


@router.post("/atlassian/token", status_code=status.HTTP_204_NO_CONTENT)
async def store_atlassian_token(
    request: AtlassianTokenRequest,
    user_info: AuthenticatedUser,
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    source_id, _ = _get_atlassian_source(settings)
    await AtlassianOAuthTokenStore.set_token(
        user_id=user_info.user_id,
        access_token=request.access_token,
        token_type=request.token_type,
        ttl=request.expires_in,
        source_id=source_id,
    )


@router.delete("/atlassian/token", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_atlassian(
    user_info: AuthenticatedUser,
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    source_id, _ = _get_atlassian_source(settings)
    await AtlassianOAuthTokenStore.delete_token(user_info.user_id, source_id)
