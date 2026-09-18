import type { TFunction } from "i18next";
import { CheckmarkCircle16Regular, CircleOff16Regular, Clock16Regular } from "@fluentui/react-icons";
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
    const assistantState =
        "latest_version" in assistant.rawData ? assistant.rawData.latest_version.state : "state" in assistant.rawData ? assistant.rawData.state : undefined;

    if (isComplianceCheckEnabled && assistantState === "pending_legal_review") {
        badges.push({
            label: t("components.community_assistants.pending_review_badge"),
            icon: <Clock16Regular aria-hidden="true" />,
            tone: "warning"
        });
    } else if (isComplianceCheckEnabled && assistantState === "inactive") {
        badges.push({
            label: t("components.community_assistants.inactive_badge"),
            icon: <CircleOff16Regular aria-hidden="true" />,
            tone: "danger"
        });
    }

    // The lifecycle state is authoritative after legal review. An active assistant
    // may retain a high-risk automated result that was accepted by a reviewer.
    if (
        isComplianceCheckEnabled &&
        assistantState === "active" &&
        (complianceCheckResult?.overall_status === "passed" || complianceCheckResult?.overall_status === "high_risk_detected")
    ) {
        badges.push({
            label: t("components.community_assistants.accepted_badge"),
            icon: <CheckmarkCircle16Regular aria-hidden="true" />,
            tone: "success"
        });
    }

    if (assistant.isLocalAssistant) {
        badges.push({
            label: t("components.community_assistants.local_badge", "Lokal"),
            tone: "warning"
        });
    }

    if (assistant.isDeletedSnapshot) {
        badges.push({
            label: t("components.community_assistants.deleted_badge", "Gelöscht"),
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
