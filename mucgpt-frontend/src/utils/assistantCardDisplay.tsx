import type { TFunction } from "i18next";
import type { AssistantCardData } from "../components/AssistantDetailsSidebar/AssistantDetailsSidebar";
import type { DiscoveryCardBadge } from "../components/DiscoveryCard/DiscoveryCard";

export const getAssistantBadges = (
    assistant: Pick<AssistantCardData, "rawData" | "isLocalAssistant" | "isDeletedSnapshot">,
    t: TFunction,
    isComplianceCheckEnabled?: boolean
): DiscoveryCardBadge[] => {
    const badges: DiscoveryCardBadge[] = [];
    const complianceCheckResult =
        "latest_version" in assistant.rawData
            ? assistant.rawData.latest_version.compliance_check_result
            : "compliance_check_result" in assistant.rawData
              ? assistant.rawData.compliance_check_result
              : undefined;

    if (isComplianceCheckEnabled && complianceCheckResult?.overall_status === "passed") {
        badges.push({
            label: t("components.community_assistants.compliance_passed_badge"),
            color: "success",
            tone: "success"
        });
    }

    if (isComplianceCheckEnabled && complianceCheckResult?.overall_status === "high_risk_detected") {
        badges.push({
            label: t("components.community_assistants.compliance_high_risk_badge"),
            color: "danger",
            tone: "danger"
        });
    }

    if (assistant.isLocalAssistant) {
        badges.push({
            label: t("components.community_assistants.local_badge", "Lokal"),
            color: "warning",
            tone: "warning"
        });
    }

    if (assistant.isDeletedSnapshot) {
        badges.push({
            label: t("components.community_assistants.deleted_badge", "Gelöscht"),
            color: "danger",
            tone: "danger"
        });
    }

    return badges;
};

export const isAssistantPrivate = (assistant: Pick<AssistantCardData, "rawData" | "isLocalAssistant">): boolean => {
    if (assistant.isLocalAssistant) {
        return true;
    }

    if ("is_visible" in assistant.rawData) {
        return assistant.rawData.is_visible === false;
    }

    return false;
};
