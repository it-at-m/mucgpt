// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { chatApi } from "../../api/core-client";
import Chat from "./Chat";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("react-router-dom", () => ({ useLocation: () => ({ hash: "", search: "" }), useNavigate: () => vi.fn() }));
vi.mock("../../api/core-client", () => ({ chatApi: vi.fn(), createChatName: vi.fn().mockResolvedValue("Chat") }));
vi.mock("../../service/storage", () => ({
    StorageService: class {
        getAll = vi.fn().mockResolvedValue([]);
        create = vi.fn().mockResolvedValue("thread");
        appendMessage = vi.fn().mockResolvedValue(undefined);
    }
}));
vi.mock("../../components/ToolsProvider", () => ({ useToolsContext: () => ({ tools: undefined }) }));
vi.mock("../../context/ConfigContext", () => ({ useConfigContext: () => ({ ag_ui_enabled: false }) }));
vi.mock("../../hooks/useToolStatusToasts", () => ({ useToolStatusToasts: () => {} }));
vi.mock("../../components/UnifiedHistory", () => ({
    useUnifiedHistory: () => ({ refreshHistory: vi.fn() }),
    useUnifiedHistoryRegistration: () => {}
}));
vi.mock("../../components/ChatSettingsDialog/ChatSettingsDialog", () => ({ ChatSettingsDialog: () => null }));
vi.mock("../../components/AgUiEventDrawer/AgUiEventDrawer", () => ({ AgUiEventDrawer: () => null }));
vi.mock("../../components/ChatLayout/ChatLayout", () => ({
    ChatLayout: ({ answers, input }: { answers: ReactNode; input: ReactNode }) => (
        <>
            {answers}
            {input}
        </>
    )
}));
vi.mock("../../components/Answer", () => ({ Answer: ({ answer }: { answer: { answer: string } }) => <p>{answer.answer}</p> }));
vi.mock("../../components/QuestionInput", () => ({
    QuestionInput: ({
        disabled,
        question,
        setQuestion,
        onSend
    }: {
        disabled: boolean;
        question: string;
        setQuestion: (value: string) => void;
        onSend: (value: string, data: []) => void;
    }) => (
        <textarea
            aria-label="Message"
            disabled={disabled}
            value={question}
            onChange={event => setQuestion(event.target.value)}
            onKeyDown={event => {
                if (event.key === "Enter" && !disabled && question.trim()) {
                    onSend(question, []);
                    setQuestion("");
                }
            }}
        />
    )
}));

const sendMessage = (message: string) => {
    fireEvent.change(screen.getByRole("textbox", { name: "Message" }), { target: { value: message } });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Message" }), { key: "Enter" });
};

describe("chat error recovery", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        sessionStorage.clear();
    });

    it.each([false, true])("allows a new message after a failure (stream started: %s)", async streamStarted => {
        const api = vi.mocked(chatApi);
        api.mockResolvedValueOnce(new Response('data: {"choices":[{"delta":{"content":"Original answer"}}]}\n\ndata: [DONE]\n\n'));
        render(<Chat />);
        sendMessage("Original question");
        await screen.findByText("Original answer");
        await waitFor(() => expect(screen.getByRole("textbox", { name: "Message" })).toBeEnabled());

        let failRequest!: () => void;
        if (streamStarted) {
            api.mockResolvedValueOnce(
                new Response(
                    new ReadableStream({
                        start(controller) {
                            failRequest = () => controller.error(new Error("Failed run"));
                        }
                    })
                )
            );
        } else {
            api.mockImplementationOnce(() => new Promise((_resolve, reject) => (failRequest = () => reject(new Error("Failed run")))));
        }
        sendMessage("Failed question");
        await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
        // The composer stays locked even after response headers arrive and the loading indicator disappears.
        await act(async () => {});
        expect(screen.getByRole("textbox", { name: "Message" })).toBeDisabled();
        await act(async () => failRequest());
        await screen.findByText(/Failed run/);
        expect(screen.getByRole("textbox", { name: "Message" })).toBeEnabled();
        expect(screen.queryByRole("button", { name: "components.answererror.retry" })).not.toBeInTheDocument();

        api.mockResolvedValueOnce(new Response('data: {"choices":[{"delta":{"content":"Recovered answer"}}]}\n\ndata: [DONE]\n\n'));
        sendMessage("New question");
        await screen.findByText("Recovered answer");
        expect(screen.queryByText(/Failed run/)).not.toBeInTheDocument();
        expect(screen.getByText("Original answer")).toBeInTheDocument();
        expect(api).toHaveBeenLastCalledWith(
            expect.objectContaining({
                persist: true,
                conversation_id: "thread",
                history: expect.arrayContaining([
                    { user: "Original question", assistant: "Original answer" },
                    { user: "New question", assistant: undefined }
                ])
            })
        );
    });
});
