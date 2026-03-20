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

const isAssistantResponse = (data: AssistantResponse | CommunityAssistantSnapshot): data is AssistantResponse =>
    "latest_version" in data && data.latest_version != null && typeof (data as AssistantResponse).latest_version.name === "string";

const buildDuplicatedAssistantTitle = (title: string, copyLabel: string): string => {
    const trimmedTitle = title.trim();
    const trimmedCopyLabel = copyLabel.trim();

    if (!trimmedTitle || !trimmedCopyLabel) {
        return trimmedTitle || title;
    }

    return `${trimmedTitle} ${trimmedCopyLabel}`;
};

export const useDuplicateAssistant = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showError, showSuccess } = useGlobalToastContext();
    const communityAssistantStorageService = useMemo(() => new CommunityAssistantStorageService(COMMUNITY_ASSISTANT_STORE), []);

    const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
    const [assistantToDuplicate, setAssistantToDuplicate] = useState<DuplicateAssistantCandidate | null>(null);
    const [isDuplicating, setIsDuplicating] = useState(false);

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

    const confirmDuplicateAssistant = useCallback(async () => {
        if (!assistantToDuplicate || isDuplicating) {
            return;
        }

        setIsDuplicating(true);
        try {
            const assistantData = await resolveAssistantData(assistantToDuplicate.id, assistantToDuplicate.rawData);
            const assistantConfig = isAssistantResponse(assistantData)
                ? mapAssistantResponseToCommunityConfig(assistantData)
                : mapCommunitySnapshotToCommunityConfig(assistantData);
            const assistantTitle = isAssistantResponse(assistantData) ? assistantData.latest_version.name : assistantData.title;
            const duplicatedAssistantTitle = buildDuplicatedAssistantTitle(assistantTitle, t("components.community_assistants.duplicate_title_suffix"));
            const duplicatedAssistant = await createCommunityAssistantApi({
                ...mapCommunityConfigToAssistantCreateInput(assistantConfig),
                name: duplicatedAssistantTitle,
                is_visible: false,
                hierarchical_access: []
            });

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
    }, [assistantToDuplicate, isDuplicating, navigate, resolveAssistantData, showError, showSuccess, t]);

    return {
        assistantToDuplicate,
        showDuplicateConfirm,
        isDuplicating,
        setShowDuplicateConfirm,
        requestDuplicateAssistant,
        confirmDuplicateAssistant,
        resolveAssistantData
    };
};
