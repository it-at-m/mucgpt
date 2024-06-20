from enum import Enum, unique


@unique
class SupportedModels(Enum):
    AZURE_CHATGPT = "AZURE_CHATGPT"
    FAKE = "FAKE"