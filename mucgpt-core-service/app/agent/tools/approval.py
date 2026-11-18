from typing import cast

from langchain_core.tools.base import BaseTool

from config.settings import DEFAULT_DATA_CLASSIFICATION, DataClassification

REQUIRE_APPROVAL_KEY = "require_approval"
DATA_CLASSIFICATION_KEY = "data_classification"


def approval_metadata(
    require_approval: bool, data_classification: DataClassification
) -> dict[str, object]:
    return {
        REQUIRE_APPROVAL_KEY: require_approval,
        DATA_CLASSIFICATION_KEY: data_classification,
    }


def requires_approval(tool: BaseTool) -> bool:
    return bool((tool.metadata or {}).get(REQUIRE_APPROVAL_KEY, False))


def data_classification(tool: BaseTool) -> DataClassification:
    return cast(
        DataClassification,
        (tool.metadata or {}).get(DATA_CLASSIFICATION_KEY, DEFAULT_DATA_CLASSIFICATION),
    )
