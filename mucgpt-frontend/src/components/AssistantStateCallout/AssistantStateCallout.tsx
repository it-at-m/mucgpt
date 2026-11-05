import type { MessageBarIntent } from "@fluentui/react-components";
import { Add20Regular, ArrowExportUp20Regular, Chat20Regular, Copy20Regular, Delete20Regular, Edit20Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import { Button } from "../../ui/Button";
import { Callout } from "../../ui/Callout";

export type AssistantCalloutState = "deleted" | "missing" | "unsubscribed" | "local" | "legacy" | "pending_legal_review" | "inactive";

interface AssistantStateCalloutProps {
    state: AssistantCalloutState;
    /** The details sidebar stacks its actions; the chat shows them inline above the composer. */
    context: "details" | "chat";
    onSubscribe?: () => void;
    onDuplicate?: () => void;
    onMigrateLocal?: () => void;
    onOpenChatHistory?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
}

export const AssistantStateCallout = ({
    state,
    context,
    onSubscribe,
    onDuplicate,
    onMigrateLocal,
    onOpenChatHistory,
    onEdit,
    onDelete
}: AssistantStateCalloutProps) => {
    const { t } = useTranslation();
    const isChat = context === "chat";

    const content: Record<AssistantCalloutState, { intent: MessageBarIntent; title: string; hint: string }> = {
        deleted: {
            intent: "error",
            title: t("components.community_assistants.deleted_state_title"),
            hint: isChat ? t("components.community_assistants.deleted_chat_warning") : t("components.community_assistants.discovery_deleted_hint")
        },
        missing: {
            intent: "error",
            title: t("components.community_assistants.missing_state_title"),
            hint: t("components.community_assistants.missing_chat_warning")
        },
        unsubscribed: {
            intent: "warning",
            title: t("components.community_assistants.unsubscribed_state_title"),
            hint: t("components.community_assistants.unsubscribed_state_hint")
        },
        local: {
            intent: "warning",
            title: t("components.community_assistants.local_state_title"),
            hint: isChat ? t("components.community_assistants.local_chat_warning") : t("components.community_assistants.discovery_local_hint")
        },
        legacy: {
            intent: "error",
            title: t("components.community_assistants.legacy_state_title"),
            hint: t("components.community_assistants.legacy_state_hint")
        },
        pending_legal_review: {
            intent: "warning",
            title: t("components.community_assistants.pending_review_title"),
            hint: t("components.community_assistants.pending_review_hint")
        },
        inactive: {
            intent: "error",
            title: t("components.community_assistants.inactive_title"),
            hint: t("components.community_assistants.inactive_hint")
        }
    };
    const { intent, title, hint } = content[state];

    const isOutdated = state === "deleted" || state === "missing" || state === "local" || state === "legacy";
    const isUnavailable = state === "pending_legal_review" || state === "inactive";

    const primaryActions = [
        state === "unsubscribed" && onSubscribe && (
            <Button key="subscribe" appearance="primary" icon={<Add20Regular />} onClick={onSubscribe}>
                {t("components.not_subscribed_dialog.subscribe_button")}
            </Button>
        ),
        state === "deleted" && onDuplicate && (
            <Button key="duplicate" appearance="primary" icon={<Copy20Regular />} onClick={onDuplicate}>
                {t("components.community_assistants.deleted_state_save_action")}
            </Button>
        ),
        state === "local" && onMigrateLocal && (
            <Button key="migrate" appearance="primary" icon={<ArrowExportUp20Regular />} onClick={onMigrateLocal}>
                {t("components.community_assistants.local_state_publish_action")}
            </Button>
        )
    ].filter(Boolean);
    const primaryAction = primaryActions.length > 0 ? <>{primaryActions}</> : undefined;

    const secondaryActions = [
        isUnavailable && onEdit && (
            <Button key="edit" appearance="outline" icon={<Edit20Regular />} onClick={onEdit}>
                {t("common.edit")}
            </Button>
        ),
        isOutdated && onOpenChatHistory && (
            <Button key="history" appearance="outline" icon={<Chat20Regular />} onClick={onOpenChatHistory}>
                {t("components.community_assistants.deleted_state_history_action")}
            </Button>
        ),
        isOutdated && onDelete && (
            <Button key="delete" appearance="outline" tone="danger" icon={<Delete20Regular />} onClick={onDelete}>
                {t(state === "deleted" || state === "missing" ? "components.community_assistants.delete_chats_action" : "common.delete")}
            </Button>
        )
    ].filter(Boolean);

    return (
        <Callout intent={intent} title={title} primaryAction={primaryAction} secondaryActions={secondaryActions} actionsLayout={isChat ? "inline" : "stack"}>
            {hint}
        </Callout>
    );
};
