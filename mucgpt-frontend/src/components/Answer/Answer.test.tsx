import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Answer } from "./Answer";
import { AnswerError } from "./AnswerError";
import { AnswerList } from "../AnswerList/AnswerList";

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

    it("renders an error and explanation without an actionable retry", () => {
        const html = renderToStaticMarkup(<AnswerError error="Failed run" retryUnavailableReason={reason} />);
        expect(html).toContain("Failed run");
        expect(html).toContain(reason);
        expect(html).not.toContain("<button");
    });

    it("retains the stateless retry button", () => {
        const html = renderToStaticMarkup(<AnswerError error="Failed run" onRetry={vi.fn()} />);
        expect(html).toContain("<button");
        expect(html).toContain("components.answererror.retry");
    });

    it.each([true, false])("AnswerList forwards retry only when canRetry=%s, even with a supplied callback", canRetry => {
        const html = renderToStaticMarkup(
            <AnswerList
                answers={[]}
                regularAssistantMsg={() => null}
                isLoading={false}
                error={new Error("Failed first run")}
                makeApiRequest={vi.fn()}
                canRetry={canRetry}
                retryUnavailableReason={reason}
                chatMessageStreamEnd={{ current: null }}
                lastQuestionRef={{ current: "Question" }}
            />
        );
        expect(html).toContain("Failed first run");
        expect(html.includes("components.answererror.retry")).toBe(canRetry);
        expect(html.includes(reason)).toBe(!canRetry);
    });
});
