import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createCommunityAssistantApi, getCommunityAssistantApi } from "../../../api/assistant-client";
import { AssistantResponse, CommunityAssistantSnapshot } from "../../../api/models";
import { ApiError } from "../../../api/fetch-utils";
import { useGlobalToastContext } from "../../../components/GlobalToastHandler/GlobalToastContext";
import { COMMUNITY_ASSISTANT_STORE } from "../../../constants";
import { CommunityAssistantStorageService } from "../../../service/communityassistantstorage";
import {
    isCompleteCommunityAssistantSnapshot,
    mapAssistantResponseToCommunityConfig,
    mapCommunityConfigToAssistantCreateInput,
    mapCommunitySnapshotToCommunityConfig,
    resolveDeletedCommunityAssistantSnapshot
} from "../../../utils/community-assistant-snapshots";

export interface DuplicateAssistantCandidate {
    id: string;
    title: string;
    rawData?: AssistantResponse | CommunityAssistantSnapshot;
    isDeletedSnapshot?: boolean;
}

export const useDuplicateAssistant = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showError, showSuccess } = useGlobalToastContext();
    const communityAssistantStorageService = useMemo(() => new CommunityAssistantStorageService(COMMUNITY_ASSISTANT_STORE), []);

    const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
    const [assistantToDuplicate, setAssistantToDuplicate] = useState<DuplicateAssistantCandidate | null>(null);

    const resolveAssistantData = useCallback(
        async (assistantId: string, fallbackData?: AssistantResponse | CommunityAssistantSnapshot): Promise<AssistantResponse | CommunityAssistantSnapshot> => {
            try {
                return await getCommunityAssistantApi(assistantId);
            } catch (responseError) {
                const fallbackSnapshot = fallbackData && !("latest_version" in fallbackData) ? fallbackData : undefined;
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

                const cachedSnapshot = await communityAssistantStorageService.getAssistantConfig(assistantId);

                if (isCompleteCommunityAssistantSnapshot(cachedSnapshot)) {
                    return cachedSnapshot;
                }

                throw responseError;
            }
        },
        [communityAssistantStorageService]
    );

    const requestDuplicateAssistant = useCallback((assistant: DuplicateAssistantCandidate | null) => {
        if (!assistant) {
            return;
        }

        setAssistantToDuplicate(assistant);
        setShowDuplicateConfirm(true);
    }, []);

    const confirmDuplicateAssistant = useCallback(async () => {
        if (!assistantToDuplicate) {
            return;
        }

        try {
            const assistantData = await resolveAssistantData(assistantToDuplicate.id, assistantToDuplicate.rawData);
            const assistantConfig =
                "latest_version" in assistantData ? mapAssistantResponseToCommunityConfig(assistantData) : mapCommunitySnapshotToCommunityConfig(assistantData);
            const duplicatedAssistant = await createCommunityAssistantApi(mapCommunityConfigToAssistantCreateInput(assistantConfig));
            const assistantTitle = "latest_version" in assistantData ? assistantData.latest_version.name : assistantData.title;

            setShowDuplicateConfirm(false);
            showSuccess(
                t("components.community_assistants.duplicate_success_title"),
                t("components.community_assistants.duplicate_success_message", { title: assistantTitle })
            );
            navigate(`/owned/communityassistant/${duplicatedAssistant.id}`);
        } catch (error) {
            console.error("Failed to duplicate assistant", error);
            const errorMessage = error instanceof Error ? error.message : t("components.community_assistants.duplicate_failed_default");
            showError(t("components.community_assistants.duplicate_failed_title"), errorMessage);
        }
    }, [assistantToDuplicate, navigate, resolveAssistantData, showError, showSuccess, t]);

    return {
        assistantToDuplicate,
        showDuplicateConfirm,
        setShowDuplicateConfirm,
        requestDuplicateAssistant,
        confirmDuplicateAssistant,
        resolveAssistantData
    };
};
