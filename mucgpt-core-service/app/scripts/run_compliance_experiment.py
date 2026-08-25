import argparse
import asyncio
import logging
import os
from collections.abc import Callable, Sequence
from datetime import datetime
from pathlib import Path
from typing import Any

from truststore import inject_into_ssl

if os.getenv("TRUSTSTORE_DISABLE", "0") not in {"1", "true", "TRUE", "yes"}:
    try:
        inject_into_ssl()
    except Exception as exc:  # pragma: no cover - platform-specific fallback
        logging.getLogger(__name__).warning("truststore injection failed: %s", exc)

from langfuse import Evaluation, Langfuse
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    YamlConfigSettingsSource,
)

from api.api_models import (
    ComplianceCategoryId,
    ComplianceCategoryResult,
    ComplianceCheckResponse,
    ComplianceStatus,
)
from config.langfuse_provider import LangfuseProvider
from config.model_provider import ModelProvider
from config.settings import ModelsConfig, Settings
from core.auth_models import AuthenticationResult
from core.compliance import evaluate_compliance
from core.lf_prompts import PromptPool

_EVALUATION_USER = AuthenticationResult(
    token="compliance-experiment",
    user_id="compliance-experiment",
    department="COMPLIANCE",
)
_CATEGORY_IDS: tuple[ComplianceCategoryId, ...] = (
    "migration_asylum_border",
    "public_services_access",
    "hr_employment",
    "education",
)
_DEFAULT_STACK_CONFIG_PATH = (
    Path(__file__).resolve().parents[3] / "stack" / "core.config.yaml"
)


class ComplianceDatasetInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    system_prompt: str = Field(min_length=1)


class ComplianceExpectedOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    overall_status: ComplianceStatus
    results: list[ComplianceCategoryResult]

    @model_validator(mode="after")
    def validate_complete_categories(self) -> "ComplianceExpectedOutput":
        categories = [result.category for result in self.results]
        if len(categories) != len(_CATEGORY_IDS) or set(categories) != set(
            _CATEGORY_IDS
        ):
            raise ValueError(
                "results must contain each compliance category exactly once"
            )
        return self


def validate_dataset_item(
    item: Any,
) -> tuple[ComplianceDatasetInput, ComplianceExpectedOutput]:
    """Validate a Langfuse dataset item before running a model invocation."""

    return (
        ComplianceDatasetInput.model_validate(item.input),
        ComplianceExpectedOutput.model_validate(item.expected_output),
    )


def _result_by_category(
    response: ComplianceCheckResponse | ComplianceExpectedOutput,
) -> dict[ComplianceCategoryId, ComplianceStatus]:
    return {result.category: result.status for result in response.results}


def _as_response(output: Any) -> ComplianceCheckResponse:
    return ComplianceCheckResponse.model_validate(output)


def overall_status_accuracy(
    *, output: Any, expected_output: Any, **_: Any
) -> Evaluation:
    actual = _as_response(output).overall_status
    expected = ComplianceExpectedOutput.model_validate(expected_output).overall_status
    return Evaluation(
        name="overall_status_accuracy",
        value=float(actual == expected),
        comment=f"expected={expected}, actual={actual}",
    )


def category_status_accuracy(
    category: ComplianceCategoryId,
) -> Callable[..., Evaluation]:
    def evaluate(*, output: Any, expected_output: Any, **_: Any) -> Evaluation:
        actual = _result_by_category(_as_response(output)).get(category)
        expected = _result_by_category(
            ComplianceExpectedOutput.model_validate(expected_output)
        )[category]
        return Evaluation(
            name=f"{category}_status_accuracy",
            value=float(actual == expected),
            comment=f"expected={expected}, actual={actual}",
        )

    evaluate.__name__ = f"{category}_status_accuracy"
    return evaluate


def all_category_statuses_match(
    *, output: Any, expected_output: Any, **_: Any
) -> Evaluation:
    actual = _result_by_category(_as_response(output))
    expected = _result_by_category(
        ComplianceExpectedOutput.model_validate(expected_output)
    )
    return Evaluation(
        name="all_category_statuses_match",
        value=float(actual == expected),
        comment="All category verdicts match"
        if actual == expected
        else "Category verdicts differ",
    )


def _average_score(name: str) -> Callable[..., Evaluation]:
    def evaluate(*, item_results: Sequence[Any], **_: Any) -> Evaluation:
        values = [
            evaluation.value
            for item_result in item_results
            for evaluation in item_result.evaluations
            if evaluation.name == name and evaluation.value is not None
        ]
        average = sum(values) / len(values) if values else None
        return Evaluation(
            name=f"mean_{name}",
            value=average,
            comment=(f"Mean {name}: {average:.2%}" if average is not None else None),
        )

    return evaluate


def _parse_dataset_version(value: str) -> datetime:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            "dataset version must be an ISO-8601 timestamp"
        ) from exc


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run EU AI Act compliance checks against a Langfuse dataset."
    )
    parser.add_argument("--dataset", required=True, help="Langfuse dataset name")
    parser.add_argument(
        "--model",
        action="append",
        required=True,
        dest="models",
        help="Configured model name; repeat for comparison runs",
    )
    parser.add_argument("--max-concurrency", type=int, default=4)
    parser.add_argument("--run-name", help="Optional prefix for each dataset run")
    parser.add_argument("--dataset-version", type=_parse_dataset_version)
    parser.add_argument(
        "--show-item-results",
        action="store_true",
        help="Print expected and actual results for every dataset item",
    )
    parser.add_argument(
        "--config",
        type=Path,
        default=_DEFAULT_STACK_CONFIG_PATH,
        help="Core service YAML configuration path",
    )
    return parser.parse_args()


def _load_settings(config_path: Path) -> Settings:
    if not config_path.is_file():
        raise RuntimeError(f"Configuration file not found: {config_path}")

    class _ScriptSettings(Settings):
        @classmethod
        def settings_customise_sources(
            cls,
            settings_cls: type[BaseSettings],
            init_settings: PydanticBaseSettingsSource,
            env_settings: PydanticBaseSettingsSource,
            dotenv_settings: PydanticBaseSettingsSource,
            file_secret_settings: PydanticBaseSettingsSource,
        ) -> tuple[PydanticBaseSettingsSource, ...]:
            return (
                init_settings,
                env_settings,
                YamlConfigSettingsSource(settings_cls, yaml_file=config_path),
                dotenv_settings,
            )

    return _ScriptSettings()


def _initialize_evaluation_context(
    settings: Settings,
    models: list[ModelsConfig],
) -> Langfuse:
    ModelProvider.init_model(models, streaming=False, temperature=0.0)

    langfuse_settings = settings.LANGFUSE
    if not (
        langfuse_settings.HOST
        and langfuse_settings.PUBLIC_KEY
        and langfuse_settings.SECRET_KEY
    ):
        raise RuntimeError(
            "LANGFUSE HOST, PUBLIC_KEY, and SECRET_KEY must be configured"
        )

    LangfuseProvider.init(version=settings.VERSION, langfuse_cfg=langfuse_settings)
    client = Langfuse(
        public_key=langfuse_settings.PUBLIC_KEY,
        secret_key=langfuse_settings.SECRET_KEY.get_secret_value(),
        host=langfuse_settings.HOST,
        release=settings.VERSION,
    )
    PromptPool.init(client, settings.PROMPTS)
    return client


async def _run_experiments(args: argparse.Namespace) -> None:
    if args.max_concurrency < 1:
        raise ValueError("--max-concurrency must be at least 1")

    settings = _load_settings(args.config)
    models_by_name = {model.llm_name: model for model in settings.MODELS}
    unknown_models = set(args.models) - models_by_name.keys()
    if unknown_models:
        raise ValueError(
            "Unknown configured model(s): "
            + ", ".join(sorted(unknown_models))
            + ". Available models: "
            + ", ".join(sorted(models_by_name))
        )
    selected_models = [models_by_name[model_name] for model_name in args.models]
    langfuse = _initialize_evaluation_context(settings, selected_models)

    try:
        dataset = langfuse.get_dataset(args.dataset, version=args.dataset_version)
        evaluators = [
            overall_status_accuracy,
            *(category_status_accuracy(category) for category in _CATEGORY_IDS),
            all_category_statuses_match,
        ]
        run_evaluators = [
            _average_score(evaluator.__name__) for evaluator in evaluators
        ]

        for model_name in args.models:

            async def task(*, item: Any, **_: Any) -> dict[str, Any]:
                dataset_input, _ = validate_dataset_item(item)
                response = await evaluate_compliance(
                    system_prompt=dataset_input.system_prompt,
                    model_name=model_name,
                    user_info=_EVALUATION_USER,
                    config=settings.COMPLIANCE,
                )
                return response.model_dump(exclude={"prompt_hash"})

            run_name = "-".join(part for part in (args.run_name, model_name) if part)
            result = dataset.run_experiment(
                name="assistant-compliance",
                run_name=run_name or model_name,
                description="EU AI Act compliance prompt classification benchmark",
                task=task,
                evaluators=evaluators,
                run_evaluators=run_evaluators,
                max_concurrency=args.max_concurrency,
                metadata={
                    "evaluation_type": "assistant-compliance",
                    "model": model_name,
                    "temperature": 0.0,
                    "categories": list(_CATEGORY_IDS),
                },
            )
            print(result.format(include_item_results=args.show_item_results))
    finally:
        langfuse.flush()


def main() -> None:
    args = parse_args()
    try:
        asyncio.run(_run_experiments(args))
    except (RuntimeError, ValidationError, ValueError) as exc:
        raise SystemExit(f"Compliance experiment failed: {exc}") from exc


if __name__ == "__main__":
    main()
