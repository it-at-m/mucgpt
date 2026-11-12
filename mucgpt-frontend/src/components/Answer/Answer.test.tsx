import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Answer } from "./Answer";
import { AnswerError } from "./AnswerError";
import { AnswerList } from "../AnswerList/AnswerList";
import { ChatProviderError } from "../../utils/providerError";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("../MarkdownRenderer/MarkdownRenderer", () => ({ MarkdownRenderer: () => null }));
vi.mock("../AnswerActivity/AnswerActivity", () => ({ AnswerActivity: () => null }));
vi.mock("../FollowUpAction", () => ({ FollowUpActionList: () => <button>Follow-up question</button> }));

describe("answer replacement controls", () => {
    const answer = { answer: "Original answer", tokens: 0, user_tokens: 0 };
    const reason = "Regeneration and retry are unavailable in saved chats. You can ask a new question.";

    beforeEach(() => vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn() } }));
    afterEach(() => vi.unstubAllGlobals());

    it("renders disabled regeneration with an accessible explanation while keeping follow-ups", () => {
        const html = renderToStaticMarkup(<Answer answer={answer} isLatest regenerationUnavailableReason={reason} onFollowUpActionSend={vi.fn()} />);
        expect(html).toMatch(/<button[^>]*aria-label="components.answer.regenerate"[^>]*disabled=""/);
        expect(html).toContain(`aria-description="${reason}"`);
        expect(html).toContain("Follow-up question");
    });

    it("keeps stateless regeneration and follow-ups enabled", () => {
        const html = renderToStaticMarkup(<Answer answer={answer} isLatest onRegenerateResponseClicked={vi.fn()} onFollowUpActionSend={vi.fn()} />);
        expect(html).toContain('aria-label="components.answer.regenerate"');
        expect(html).not.toContain('disabled=""');
        expect(html).toContain("Follow-up question");
    });

    it("keeps actions hidden while streaming", () => {
        const html = renderToStaticMarkup(
            <Answer answer={answer} isLatest isStreaming regenerationUnavailableReason={reason} onFollowUpActionSend={vi.fn()} />
        );
        expect(html).not.toContain('aria-label="components.answer.regenerate"');
        expect(html).not.toContain("Follow-up question");
    });

    it("renders a localized error and explanation without an actionable retry", () => {
        const error = new ChatProviderError("unknown", "");
        const html = renderToStaticMarkup(<AnswerError error={error} retryUnavailableReason={reason} />);
        expect(html).toContain("common.errors.provider.unknown");
        expect(html).toContain(reason);
        expect(html).not.toContain("<button");
    });

    it("keeps the technical error text out of the chat message", () => {
        const error = new ChatProviderError("server_error", "exception: openai.InternalServerError\nbody: {..secret..}");
        const html = renderToStaticMarkup(<AnswerError error={error} />);
        expect(html).toContain("common.errors.provider.server_error");
        expect(html).not.toContain("secret");
    });

    it("retains the stateless retry button", () => {
        const error = new ChatProviderError("rate_limited", "status: 429");
        const html = renderToStaticMarkup(<AnswerError error={error} onRetry={vi.fn()} />);
        expect(html).toContain("<button");
        expect(html).toContain("components.answererror.retry");
    });

    it.each([true, false])("AnswerList forwards retry only when canRetry=%s, even with a supplied callback", canRetry => {
        const html = renderToStaticMarkup(
            <AnswerList
                answers={[]}
                regularAssistantMsg={() => null}
                isLoading={false}
                error={new ChatProviderError("unknown", "")}
                makeApiRequest={vi.fn()}
                canRetry={canRetry}
                retryUnavailableReason={reason}
                chatMessageStreamEnd={{ current: null }}
                lastQuestionRef={{ current: "Question" }}
            />
        );
        expect(html).toContain("common.errors.provider.unknown");
        expect(html.includes("components.answererror.retry")).toBe(canRetry);
        expect(html.includes(reason)).toBe(!canRetry);
    });
});
