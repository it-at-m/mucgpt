from types import SimpleNamespace

import pytest
from pydantic import ValidationError
from pydantic_settings import YamlConfigSettingsSource

from config.settings import Settings
from scripts.run_compliance_experiment import (
    _DEFAULT_STACK_CONFIG_PATH,
    all_category_statuses_match,
    category_status_accuracy,
    overall_status_accuracy,
    validate_dataset_item,
)


def _expected_output() -> dict:
    return {
        "overall_status": "high_risk_detected",
        "results": [
            {
                "category": "migration_asylum_border",
                "status": "high_risk_detected",
                "reasoning": None,
            },
            {
                "category": "public_services_access",
                "status": "passed",
                "reasoning": None,
            },
            {"category": "hr_employment", "status": "passed", "reasoning": None},
            {"category": "education", "status": "passed", "reasoning": None},
        ],
    }


def test_validate_dataset_item_accepts_complete_compliance_response() -> None:
    dataset_input, expected_output = validate_dataset_item(
        SimpleNamespace(
            input={"system_prompt": "Bewerte diesen Assistenten."},
            expected_output=_expected_output(),
        )
    )

    assert dataset_input.system_prompt == "Bewerte diesen Assistenten."
    assert expected_output.overall_status == "high_risk_detected"


def test_stack_configuration_contains_configured_models() -> None:
    config_values = YamlConfigSettingsSource(
        Settings, yaml_file=_DEFAULT_STACK_CONFIG_PATH
    )()
    settings = Settings(**config_values)

    assert {model.llm_name for model in settings.MODELS} == {
        "gpt-4.1-nano",
        "gpt-4.1-mini",
        "gpt-4.1",
        "gpt-5-mini",
        "gpt-5",
    }


def test_validate_dataset_item_rejects_incomplete_categories() -> None:
    expected_output = _expected_output()
    expected_output["results"].pop()

    with pytest.raises(ValidationError, match="each compliance category exactly once"):
        validate_dataset_item(
            SimpleNamespace(
                input={"system_prompt": "Bewerte diesen Assistenten."},
                expected_output=expected_output,
            )
        )


def test_scores_ignore_reasoning_and_match_all_verdicts() -> None:
    output = _expected_output()
    output["results"][0]["reasoning"] = "Generated explanation differs."
    expected_output = _expected_output()

    assert (
        overall_status_accuracy(output=output, expected_output=expected_output).value
        == 1.0
    )
    assert (
        category_status_accuracy("migration_asylum_border")(
            output=output, expected_output=expected_output
        ).value
        == 1.0
    )
    assert (
        all_category_statuses_match(
            output=output, expected_output=expected_output
        ).value
        == 1.0
    )


def test_scores_identify_wrong_category_verdict() -> None:
    output = _expected_output()
    output["results"][2]["status"] = "high_risk_detected"

    evaluation = category_status_accuracy("hr_employment")(
        output=output, expected_output=_expected_output()
    )

    assert evaluation.name == "hr_employment_status_accuracy"
    assert evaluation.value == 0.0
