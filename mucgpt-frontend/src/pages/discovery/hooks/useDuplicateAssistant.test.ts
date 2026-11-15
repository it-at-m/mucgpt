// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../api/fetch-utils";
import type { AssistantResponse, CommunityAssistantSnapshot } from "../../../api/models";
import { COMMUNITY_ASSISTANT_SNAPSHOT_VERSION } from "../../../utils/community-assistant-snapshots";
import { useDuplicateAssistant } from "./useDuplicateAssistant";

vi.mock("react-router-dom", () => ({ useNavigate: vi.fn() }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../../../api/assistant-client", async importOriginal => {
    const actual = await importOriginal<typeof import("../../../api/assistant-client")>();
    return { ...actual, getCommunityAssistantApi: vi.fn(), duplicateCommunityAssistantApi: vi.fn(), createCommunityAssistantApi: vi.fn() };
});
vi.mock("../../../components/GlobalToastHandler/GlobalToastContext", () => ({ useGlobalToastContext: vi.fn() }));
vi.mock("../../../service/communityassistantstorage", async importOriginal => {
    const actual = await importOriginal<typeof import("../../../service/communityassistantstorage")>();
    return {
        ...actual,
        CommunityAssistantStorageService: vi.fn(function () {
            return communityStorageDouble;
        })
    };
});
vi.mock("../../../service/assistantstorage", async importOriginal => {
    const actual = await importOriginal<typeof import("../../../service/assistantstorage")>();
    return {
        ...actual,
        AssistantStorageService: vi.fn(function () {
            return assistantStorageDouble;
        })
    };
});

const { getCommunityAssistantApi, duplicateCommunityAssistantApi, createCommunityAssistantApi } = await import("../../../api/assistant-client");
const { useNavigate } = await import("react-router-dom");
const { useGlobalToastContext } = await import("../../../components/GlobalToastHandler/GlobalToastContext");

const communityStorageDouble = {
    getAssistantConfig: vi.fn(),
    deleteConfigForAssistant: vi.fn().mockResolvedValue(undefined)
};
const assistantStorageDouble = {
    transferChatsToAssistant: vi.fn().mockResolvedValue(undefined)
};

const completeSnapshot = (id: string, title = "Community Assistent"): CommunityAssistantSnapshot => ({
    snapshot_version: COMMUNITY_ASSISTANT_SNAPSHOT_VERSION,
    id,
    version: "3",
    title,
    description: "Beschreibung",
    system_message: "System",
    creativity: "medium",
    examples: [],
    quick_prompts: [],
    tags: [],
    hierarchical_access: [],
    tools: [],
    is_visible: true
});

const assistantResponse = (id: string, name = "Server Assistent"): AssistantResponse =>
    ({ id, latest_version: { name, version: "5" } }) as unknown as AssistantResponse;

function setup() {
    const navigate = vi.fn();
    const showError = vi.fn();
    const showSuccess = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigate);
    vi.mocked(useGlobalToastContext).mockReturnValue({ showError, showSuccess } as never);
    const utils = renderHook(() => useDuplicateAssistant());
    return { navigate, showError, showSuccess, ...utils };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCommunityAssistantApi).mockReset();
    vi.mocked(duplicateCommunityAssistantApi).mockReset();
    vi.mocked(createCommunityAssistantApi).mockReset();
    vi.mocked(communityStorageDouble.getAssistantConfig).mockReset();
    vi.mocked(assistantStorageDouble.transferChatsToAssistant).mockClear();
    vi.mocked(communityStorageDouble.deleteConfigForAssistant).mockClear();
});

describe("useDuplicateAssistant", () => {
    it("queues an assistant for duplication and opens the confirmation dialog", () => {
        const { result } = setup();

        expect(result.current.showDuplicateConfirm).toBe(false);
        act(() => {
            act(() => {
                result.current.requestDuplicateAssistant({ id: "a-1", title: "Mein Assistent" });
            });
        });

        expect(result.current.assistantToDuplicate).toEqual({ id: "a-1", title: "Mein Assistent" });
        expect(result.current.showDuplicateConfirm).toBe(true);
    });

    it("ignores requests while a duplication is running or nothing was given", () => {
        const { result } = setup();

        act(() => {
            act(() => {
                result.current.requestDuplicateAssistant(null);
            });
        });
        expect(result.current.assistantToDuplicate).toBeNull();
        expect(result.current.showDuplicateConfirm).toBe(false);
    });

    it("duplicates a server assistant via the duplicate API and navigates to it", async () => {
        vi.mocked(getCommunityAssistantApi).mockResolvedValue(assistantResponse("a-1"));
        vi.mocked(duplicateCommunityAssistantApi).mockResolvedValue({ id: "copy-1" } as never);
        const { result, navigate, showSuccess, showError } = setup();

        act(() => {
            act(() => {
                result.current.requestDuplicateAssistant({ id: "a-1", title: "Server Assistent", rawData: assistantResponse("a-1") });
            });
        });
        await result.current.confirmDuplicateAssistant();
        await waitFor(() => expect(result.current.isDuplicating).toBe(false));

        expect(getCommunityAssistantApi).toHaveBeenCalledWith("a-1");
        expect(duplicateCommunityAssistantApi).toHaveBeenCalledWith("a-1");
        expect(createCommunityAssistantApi).not.toHaveBeenCalled();
        expect(showSuccess).toHaveBeenCalledWith(
            "components.community_assistants.duplicate_success_title",
            "components.community_assistants.duplicate_success_message"
        );
        expect(navigate).toHaveBeenCalledWith("/owned/communityassistant/copy-1");
        expect(showError).not.toHaveBeenCalled();
    });

    it("recreates a deleted assistant from its snapshot with a [Kopie] title and moves the chats", async () => {
        const snapshot = completeSnapshot("a-2", "Gelöschter Assistent");
        vi.mocked(getCommunityAssistantApi).mockRejectedValue(new ApiError("Not found", 404));
        vi.mocked(createCommunityAssistantApi).mockResolvedValue({ id: "copy-2" } as never);
        const { result, navigate } = setup();

        act(() => {
            act(() => {
                result.current.requestDuplicateAssistant({ id: "a-2", title: "Gelöschter Assistent", rawData: snapshot, isDeletedSnapshot: true });
            });
        });
        await result.current.confirmDuplicateAssistant();
        await waitFor(() => expect(result.current.isDuplicating).toBe(false));

        expect(createCommunityAssistantApi).toHaveBeenCalledWith(
            expect.objectContaining({
                name: "Gelöschter Assistent [Kopie]",
                system_prompt: "System",
                is_visible: false,
                hierarchical_access: []
            })
        );
        expect(assistantStorageDouble.transferChatsToAssistant).toHaveBeenCalledWith("a-2", "copy-2");
        expect(communityStorageDouble.deleteConfigForAssistant).toHaveBeenCalledWith("a-2");
        expect(navigate).toHaveBeenCalledWith("/owned/communityassistant/copy-2");
    });

    it("falls back to the cached snapshot when the assistant is gone and no rawData exists", async () => {
        const cached = completeSnapshot("a-3", "Zwischengespeichert");
        vi.mocked(getCommunityAssistantApi).mockRejectedValue(new ApiError("Not found", 404));
        vi.mocked(communityStorageDouble.getAssistantConfig).mockResolvedValue(cached);
        vi.mocked(createCommunityAssistantApi).mockResolvedValue({ id: "copy-3" } as never);
        const { result } = setup();

        act(() => {
            act(() => {
                result.current.requestDuplicateAssistant({ id: "a-3", title: "Zwischengespeichert" });
            });
        });
        await result.current.confirmDuplicateAssistant();
        await waitFor(() => expect(result.current.isDuplicating).toBe(false));

        expect(communityStorageDouble.getAssistantConfig).toHaveBeenCalledWith("a-3");
        expect(createCommunityAssistantApi).toHaveBeenCalledWith(expect.objectContaining({ name: "Zwischengespeichert [Kopie]" }));
    });

    it("rethrows non-404 fetch errors and shows the generic failure toast", async () => {
        vi.mocked(getCommunityAssistantApi).mockRejectedValue(new ApiError("Forbidden", 403));
        const { result, navigate, showError, showSuccess } = setup();

        act(() => {
            act(() => {
                result.current.requestDuplicateAssistant({ id: "a-4", title: "X" });
            });
        });
        await result.current.confirmDuplicateAssistant();
        await waitFor(() => expect(result.current.isDuplicating).toBe(false));

        expect(showError).toHaveBeenCalledWith(
            "components.community_assistants.duplicate_failed_title",
            "components.community_assistants.duplicate_failed_forbidden"
        );
        expect(navigate).not.toHaveBeenCalled();
        expect(showSuccess).not.toHaveBeenCalled();
    });

    it("uses the rate-limit message for 429 responses", async () => {
        vi.mocked(getCommunityAssistantApi).mockRejectedValue(new ApiError("Too many", 429));
        const { result, showError } = setup();

        act(() => {
            act(() => {
                result.current.requestDuplicateAssistant({ id: "a-5", title: "X" });
            });
        });
        await result.current.confirmDuplicateAssistant();
        await waitFor(() => expect(result.current.isDuplicating).toBe(false));

        expect(showError).toHaveBeenCalledWith(
            "components.community_assistants.duplicate_failed_title",
            "components.community_assistants.duplicate_failed_rate_limited"
        );
    });

    it("uses the not-found message when the 404 cannot be resolved at all", async () => {
        vi.mocked(getCommunityAssistantApi).mockRejectedValue(new ApiError("Not found", 404));
        vi.mocked(communityStorageDouble.getAssistantConfig).mockResolvedValue(undefined);
        const { result, showError } = setup();

        act(() => {
            act(() => {
                result.current.requestDuplicateAssistant({ id: "a-6", title: "X" });
            });
        });
        await result.current.confirmDuplicateAssistant();
        await waitFor(() => expect(result.current.isDuplicating).toBe(false));

        expect(showError).toHaveBeenCalledWith(
            "components.community_assistants.duplicate_failed_title",
            "components.community_assistants.duplicate_failed_not_found"
        );
    });

    it("does nothing when confirm is called without a queued assistant", async () => {
        const { result } = setup();
        await result.current.confirmDuplicateAssistant();
        expect(getCommunityAssistantApi).not.toHaveBeenCalled();
        expect(result.current.isDuplicating).toBe(false);
    });
});
