from fastapi import APIRouter, Depends

from api.api_models import ConfigResponse, ModelsDTO
from config.settings import ParserBackendType, get_settings
from core.auth import authenticate_user

router = APIRouter()
settings = get_settings()


@router.get(
    "/config",
    summary="Get application configuration",
    description="This endpoint returns the configuration of the application.",
    response_model=ConfigResponse,
    responses={
        200: {"description": "Successful Response"},
        401: {"description": "Unauthorized"},
    },
)
async def get_config(user_info=Depends(authenticate_user)) -> ConfigResponse:
    """Builds the application config response (feature flags, versions, links and model list)."""
    response = ConfigResponse(
        env_name=settings.env_name,
        alternative_logo=settings.alternative_logo,
        app_version=settings.app_version,
        core_version=settings.version,
        frontend_version=settings.frontend_version,
        assistant_version=settings.assistant_version,
        document_processing_enabled=settings.parser_backend != ParserBackendType.NONE,
        transcription_enabled=settings.transcription_enabled,
        transcription_default_model=settings.transcription_default_model,
        ai_act_compliance_check_enabled=settings.ai_act_compliance_check_enabled,
        footer_link_url=settings.footer_link_url,
        footer_label=settings.footer_label,
        faq_url=settings.faq_url,
        incident_report_url=settings.incident_report_url,
        feature_request_url=settings.feature_request_url,
        contact_mail_url=settings.contact_mail_url,
        admin_role=settings.sso.admin_role,
        ad2image_url=settings.ad2image_url,
        owner_profile_url_template=settings.owner_profile_url_template,
        ag_ui_enabled=settings.ag_ui_enabled,
    )

    models = settings.models
    for model in models:
        dto = ModelsDTO(
            llm_name=model.llm_name,
            display_name=model.display_name,
            max_output_tokens=model.max_output_tokens,
            max_input_tokens=model.max_input_tokens,
            context_warning_threshold_percent=model.context_warning_threshold_percent,
            context_critical_threshold_percent=model.context_critical_threshold_percent,
            description=model.description,
            short_description=model.short_description,
            input_cost_per_token=model.input_cost_per_token,
            output_cost_per_token=model.output_cost_per_token,
            supports_reasoning=model.supports_reasoning,
            supported_reasoning_efforts=model.model_info.supported_reasoning_efforts,
            default_reasoning_effort=model.model_info.default_reasoning_effort,
            knowledge_cut_off=model.knowledge_cut_off,
        )
        response.models.append(dto)
    return response


@router.get(
    "/health",
    summary="Health check",
    description="This endpoint can be used to check the health of the application.",
    responses={
        200: {"description": "Successful Response"},
    },
)
def health_check() -> str:
    """Returns "OK" to signal the service is up."""
    return "OK"
