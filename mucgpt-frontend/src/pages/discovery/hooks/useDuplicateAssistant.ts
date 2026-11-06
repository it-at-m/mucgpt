import { useCallback, useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { duplicateCommunityAssistantApi, getCommunityAssistantApi } from "../../../api/assistant-client";
import { AssistantResponse, CommunityAssistantSnapshot } from "../../../api/models";
import { ApiError } from "../../../api/fetch-utils";
import { useGlobalToastContext } from "../../../components/GlobalToastHandler/GlobalToastContext";
import { LLMContext } from "../../../components/LLMSelector/LLMContextProvider";
import { useToolsContext } from "../../../components/ToolsProvider";
import { hasCreateAssistantDraft, saveCreateAssistantDraft } from "../../../components/AssistantDialogs/shared/hooks/useCreateAssistantState";
import { buildCreateDraftFromDeletedSnapshot } from "../../../components/AssistantDialogs/shared/deletedAssistantDraft";
import { setPendingAfterCreateAction } from "../../../components/AssistantDialogs/shared/afterCreateAction";
import { ConfigContext } from "../../../context/ConfigContext";
import { COMMUNITY_ASSISTANT_STORE } from "../../../constants";
import { CommunityAssistantStorageService } from "../../../service/communityassistantstorage";
import { isCompleteCommunityAssistantSnapshot, resolveDeletedCommunityAssistantSnapshot } from "../../../utils/community-assistant-snapshots";

export interface DuplicateAssistantCandidate {
    id: string;
    title: string;
    rawData?: AssistantResponse | CommunityAssistantSnapshot;
    isDeletedSnapshot?: boolean;
}

const isAssistantResponse = (data: AssistantResponse | CommunityAssistantSnapshot): data is AssistantResponse =>
    "latest_version" in data && data.latest_version != null && typeof (data as AssistantResponse).latest_version.name === "string";

export const useDuplicateAssistant = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showError, showSuccess } = useGlobalToastContext();
    const { tools } = useToolsContext();
    const { availableLLMs } = useContext(LLMContext);
    const isComplianceCheckEnabled = useContext(ConfigContext).ai_act_compliance_check_enabled;
    const communityAssistantStorageService = useMemo(() => new CommunityAssistantStorageService(COMMUNITY_ASSISTANT_STORE), []);

    const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
    const [assistantToDuplicate, setAssistantToDuplicate] = useState<DuplicateAssistantCandidate | null>(null);
    const [isDuplicating, setIsDuplicating] = useState(false);
    const [pendingDeletedSnapshot, setPendingDeletedSnapshot] = useState<CommunityAssistantSnapshot | null>(null);
    const [showDraftOverwriteConfirm, setShowDraftOverwriteConfirm] = useState(false);

    const resolveAssistantData = useCallback(
        async (assistantId: string, fallbackData?: AssistantResponse | CommunityAssistantSnapshot): Promise<AssistantResponse | CommunityAssistantSnapshot> => {
            try {
                return await getCommunityAssistantApi(assistantId);
            } catch (responseError) {
                const fallbackSnapshot = fallbackData && !isAssistantResponse(fallbackData) ? fallbackData : undefined;
                const deletedSnapshot = await resolveDeletedCommunityAssistantSnapshot(
                    responseError,
                    assistantId,
                    communityAssistantStorageService,
                    fallbackSnapshot
                );

                if (deletedSnapshot) {
                    return deletedSnapshot;
                }

                if (!(responseError instanceof ApiError) || responseError.status !== 404) {
                    throw responseError;
                }

                if (fallbackData && isAssistantResponse(fallbackData)) {
                    return fallbackData;
                }

                if (isCompleteCommunityAssistantSnapshot(fallbackSnapshot) && fallbackSnapshot.id === assistantId) {
                    return fallbackSnapshot;
                }

                const cachedSnapshot = await communityAssistantStorageService.getAssistantConfig(assistantId);

                if (isCompleteCommunityAssistantSnapshot(cachedSnapshot) && cachedSnapshot.id === assistantId) {
                    return cachedSnapshot;
                }

                throw responseError;
            }
        },
        [communityAssistantStorageService]
    );

    const requestDuplicateAssistant = useCallback(
        (assistant: DuplicateAssistantCandidate | null) => {
            if (!assistant || isDuplicating) {
                return;
            }

            setAssistantToDuplicate(assistant);
            setShowDuplicateConfirm(true);
        },
        [isDuplicating]
    );

    // Forwards a deleted assistant's snapshot to the create-assistant mask, so the user reviews it in the
    // editor (including the compliance review) instead of creating a server-side copy directly.
    const startDeletedAssistantDraft = useCallback(
        (snapshot: CommunityAssistantSnapshot) => {
            const availableToolIds = new Set((tools?.tools ?? []).map(tool => tool.id));
            const availableLLMNames = new Set(availableLLMs.map(model => model.llm_name));
            const draft = buildCreateDraftFromDeletedSnapshot(snapshot, availableToolIds, availableLLMNames);

            if (!saveCreateAssistantDraft(draft)) {
                showError(t("components.import_assistant.import_error"), t("components.import_assistant.import_failed"));
                return;
            }

            if (!setPendingAfterCreateAction({ type: "reattachDeletedAssistantChats", sourceAssistantId: snapshot.id })) {
                console.error("Failed to persist the after-create re-attach action for assistant", snapshot.id);
            }

            navigate(isComplianceCheckEnabled ? "/assistant/create#compliance-review" : "/assistant/create");
        },
        [availableLLMs, isComplianceCheckEnabled, navigate, showError, t, tools]
    );

    const confirmDraftOverwrite = useCallback(() => {
        if (pendingDeletedSnapshot) {
            startDeletedAssistantDraft(pendingDeletedSnapshot);
        }
        setPendingDeletedSnapshot(null);
    }, [pendingDeletedSnapshot, startDeletedAssistantDraft]);

    const handleDraftOverwriteChange = useCallback((open: boolean) => {
        setShowDraftOverwriteConfirm(open);
        if (!open) {
            setPendingDeletedSnapshot(null);
        }
    }, []);

    const openExistingDraft = useCallback(() => {
        setPendingDeletedSnapshot(null);
        navigate("/assistant/create");
    }, [navigate]);

    const confirmDuplicateAssistant = useCallback(async () => {
        if (!assistantToDuplicate || isDuplicating) {
            return;
        }

        setIsDuplicating(true);
        try {
            const assistantData = await resolveAssistantData(assistantToDuplicate.id, assistantToDuplicate.rawData);
            const assistantTitle = isAssistantResponse(assistantData) ? assistantData.latest_version.name : assistantData.title;

            if (assistantToDuplicate.isDeletedSnapshot && !isAssistantResponse(assistantData)) {
                setShowDuplicateConfirm(false);

                if (hasCreateAssistantDraft()) {
                    setPendingDeletedSnapshot(assistantData);
                    setShowDraftOverwriteConfirm(true);
                    return;
                }

                startDeletedAssistantDraft(assistantData);
                return;
            }

            const duplicatedAssistant = await duplicateCommunityAssistantApi(assistantToDuplicate.id);

            setShowDuplicateConfirm(false);
            showSuccess(
                t("components.community_assistants.duplicate_success_title"),
                t("components.community_assistants.duplicate_success_message", { title: assistantTitle })
            );
            navigate(`/owned/communityassistant/${duplicatedAssistant.id}`);
        } catch (error) {
            console.error("Failed to duplicate assistant", error);
            let errorKey = "components.community_assistants.duplicate_failed_default";
            if (error instanceof ApiError) {
                if (error.status === 429) {
                    errorKey = "components.community_assistants.duplicate_failed_rate_limited";
                } else if (error.status === 403) {
                    errorKey = "components.community_assistants.duplicate_failed_forbidden";
                } else if (error.status === 404) {
                    errorKey = "components.community_assistants.duplicate_failed_not_found";
                }
            }
            showError(t("components.community_assistants.duplicate_failed_title"), t(errorKey));
        } finally {
            setIsDuplicating(false);
        }
    }, [assistantToDuplicate, isDuplicating, navigate, resolveAssistantData, showError, showSuccess, startDeletedAssistantDraft, t]);

    return {
        assistantToDuplicate,
        showDuplicateConfirm,
        isDuplicating,
        setShowDuplicateConfirm,
        requestDuplicateAssistant,
        confirmDuplicateAssistant,
        resolveAssistantData,
        showDraftOverwriteConfirm,
        setShowDraftOverwriteConfirm: handleDraftOverwriteChange,
        confirmDraftOverwrite,
        openExistingDraft
    };
};
