// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Assistant } from "../api/models";
import type { AssistantStorageService } from "../service/assistantstorage";
import { useMigrateLocalAssistant } from "./useMigrateLocalAssistant";
import { LocalAssistantMigrationError, migrateLocalAssistantToOwned } from "../utils/migrateLocalAssistantToOwned";

vi.mock("react-router-dom", () => ({ useNavigate: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts?.defaultValue as string) ?? key }) }));
vi.mock("../components/GlobalToastHandler/GlobalToastContext", () => ({
    useGlobalToastContext: vi.fn()
}));
vi.mock("../utils/migrateLocalAssistantToOwned", async importOriginal => {
    const actual = await importOriginal<typeof import("../utils/migrateLocalAssistantToOwned")>();
    return { ...actual, migrateLocalAssistantToOwned: vi.fn() };
});

const { useNavigate } = await import("react-router-dom");
const { useGlobalToastContext } = await import("../components/GlobalToastHandler/GlobalToastContext");

const assistant = { id: "local-1", title: "Lokal" } as Assistant;
const storageService = { noop: true } as unknown as AssistantStorageService;

function setup() {
    const navigate = vi.fn();
    const showError = vi.fn();
    const showSuccess = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    vi.mocked(useGlobalToastContext).mockReturnValue({ showError, showSuccess } as never);

    const utils = renderHook(() => useMigrateLocalAssistant(storageService));
    return { navigate, showError, showSuccess, ...utils };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("useMigrateLocalAssistant", () => {
    it("starts with the confirmation dialog closed and can request it", () => {
        const { result } = setup();

        expect(result.current.showMigrateConfirm).toBe(false);
        expect(result.current.setShowMigrateConfirm).toBeTypeOf("function");

        act(() => {
            result.current.requestMigration();
        });
        expect(result.current.showMigrateConfirm).toBe(true);
    });

    it("shows success, runs the callback and navigates to the created assistant", async () => {
        vi.mocked(migrateLocalAssistantToOwned).mockResolvedValue({ id: "created-7" } as never);
        const onSuccess = vi.fn();
        const { result, navigate, showError, showSuccess } = setup();

        await result.current.performMigration(assistant, "local-1", "Mein Titel", onSuccess);

        expect(migrateLocalAssistantToOwned).toHaveBeenCalledWith(assistant, "local-1", storageService);
        expect(onSuccess).toHaveBeenCalledOnce();
        expect(showSuccess).toHaveBeenCalledExactlyOnceWith(
            "components.community_assistants.local_migration_success_title",
            "components.community_assistants.local_migration_success_message"
        );
        expect(navigate).toHaveBeenCalledWith("/owned/communityassistant/created-7");
        expect(showError).not.toHaveBeenCalled();
    });

    it("handles a cleanup failure: error toast and navigation to the created assistant", async () => {
        vi.mocked(migrateLocalAssistantToOwned).mockRejectedValue(new LocalAssistantMigrationError("idb full", "cleanup_failed", "created-7"));
        const onSuccess = vi.fn();
        const { result, navigate, showError } = setup();

        await result.current.performMigration(assistant, "local-1", "Mein Titel", onSuccess);

        await waitFor(() => expect(showError).toHaveBeenCalledOnce());
        expect(showError).toHaveBeenCalledWith(
            "components.community_assistants.local_migration_failed_title",
            "Der Assistent wurde privat erstellt, aber die lokale Version konnte nicht gelöscht werden."
        );
        expect(onSuccess).not.toHaveBeenCalled();
        expect(navigate).toHaveBeenCalledWith("/owned/communityassistant/created-7");
    });

    it("reports a cleanup failure without a created assistant as error only", async () => {
        vi.mocked(migrateLocalAssistantToOwned).mockRejectedValue(new LocalAssistantMigrationError("idb full", "cleanup_failed"));
        const { result, navigate, showError } = setup();

        await result.current.performMigration(assistant, "local-1", "Mein Titel");

        expect(showError).toHaveBeenCalledOnce();
        expect(navigate).not.toHaveBeenCalled();
    });

    it("reports a creation failure with the create-failed default message", async () => {
        vi.mocked(migrateLocalAssistantToOwned).mockRejectedValue(new LocalAssistantMigrationError("offline", "create_failed"));
        const { result, navigate, showError, showSuccess } = setup();

        await result.current.performMigration(assistant, "local-1", "Mein Titel");

        expect(showError).toHaveBeenCalledWith(
            "components.community_assistants.local_migration_failed_title",
            "Der Assistent konnte nicht privat erstellt werden."
        );
        expect(navigate).not.toHaveBeenCalled();
        expect(showSuccess).not.toHaveBeenCalled();
    });

    it("passes through plain error messages", async () => {
        vi.mocked(migrateLocalAssistantToOwned).mockRejectedValue(new Error("Angebot blockiert"));
        const { result, showError } = setup();

        await result.current.performMigration(assistant, "local-1", "Mein Titel");

        expect(showError).toHaveBeenCalledWith("components.community_assistants.local_migration_failed_title", "Angebot blockiert");
    });

    it("falls back to the default message for non-Error throwables", async () => {
        vi.mocked(migrateLocalAssistantToOwned).mockRejectedValue(undefined);
        const { result, showError } = setup();

        await result.current.performMigration(assistant, "local-1", "Mein Titel");

        expect(showError).toHaveBeenCalledWith(
            "components.community_assistants.local_migration_failed_title",
            "components.community_assistants.local_migration_failed_default"
        );
    });
});
