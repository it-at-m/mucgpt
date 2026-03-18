import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Assistant } from "../api/models";
import { AssistantStorageService } from "../service/assistantstorage";
import { useGlobalToastContext } from "../components/GlobalToastHandler/GlobalToastContext";
import { LocalAssistantMigrationError, migrateLocalAssistantToOwned } from "../utils/migrateLocalAssistantToOwned";

export const useMigrateLocalAssistant = (assistantStorageService: AssistantStorageService) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { showError, showSuccess } = useGlobalToastContext();

    const [showMigrateConfirm, setShowMigrateConfirm] = useState(false);

    const requestMigration = useCallback(() => setShowMigrateConfirm(true), []);

    const performMigration = useCallback(
        async (assistant: Assistant, assistantId: string, title: string, onSuccess?: () => void) => {
            try {
                const migrated = await migrateLocalAssistantToOwned(assistant, assistantId, assistantStorageService);
                showSuccess(
                    t("components.community_assistants.local_migration_success_title"),
                    t("components.community_assistants.local_migration_success_message", { title })
                );
                onSuccess?.();
                navigate(`/owned/communityassistant/${migrated.id}`);
            } catch (error) {
                if (error instanceof LocalAssistantMigrationError && error.kind === "cleanup_failed") {
                    showError(
                        t("components.community_assistants.local_migration_failed_title"),
                        t("components.community_assistants.local_migration_cleanup_failed_default", {
                            defaultValue: "Der Assistent wurde privat erstellt, aber die lokale Version konnte nicht gelöscht werden."
                        })
                    );
                    if (error.createdAssistantId) {
                        navigate(`/owned/communityassistant/${error.createdAssistantId}`);
                    }
                    return;
                }

                showError(
                    t("components.community_assistants.local_migration_failed_title"),
                    error instanceof LocalAssistantMigrationError && error.kind === "create_failed"
                        ? t("components.community_assistants.local_migration_create_failed_default", {
                              defaultValue: "Der Assistent konnte nicht privat erstellt werden."
                          })
                        : error instanceof Error
                          ? error.message
                          : t("components.community_assistants.local_migration_failed_default")
                );
            }
        },
        [assistantStorageService, navigate, showError, showSuccess, t]
    );

    return { showMigrateConfirm, setShowMigrateConfirm, requestMigration, performMigration };
};
