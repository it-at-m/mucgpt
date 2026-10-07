import { EventType, type BaseEvent } from "@ag-ui/core";
import { describe, expect, it } from "vitest";
import { getRunningStep, getStepsDurationSeconds, initialRunActivity, reduceRunActivity, type RunActivity } from "./agUiActivity";

const replay = (events: BaseEvent[]): RunActivity => events.reduce((state, event, index) => reduceRunActivity(state, event, index), initialRunActivity);

const runStarted = { type: EventType.RUN_STARTED, threadId: "t", runId: "r" } as BaseEvent;
const toolStart = (toolCallId: string, toolCallName: string) => ({ type: EventType.TOOL_CALL_START, toolCallId, toolCallName }) as BaseEvent;
const toolResult = (toolCallId: string) => ({ type: EventType.TOOL_CALL_RESULT, toolCallId, messageId: "m", content: "ok" }) as BaseEvent;
const toolArgs = (toolCallId: string, delta: string) => ({ type: EventType.TOOL_CALL_ARGS, toolCallId, delta }) as BaseEvent;
const toolEnd = (toolCallId: string) => ({ type: EventType.TOOL_CALL_END, toolCallId }) as BaseEvent;
const textContent = { type: EventType.TEXT_MESSAGE_CONTENT, messageId: "m", delta: "Hallo" } as BaseEvent;

describe("reduceRunActivity", () => {
    it("starts thinking without steps", () => {
        expect(replay([runStarted])).toEqual({ phase: "thinking", steps: [], startedAt: 0 });
    });

    it("keeps the start time set when the request was sent", () => {
        expect(reduceRunActivity({ ...initialRunActivity, startedAt: 42 }, runStarted, 99).startedAt).toBe(42);
    });

    it("tracks a tool call from start to result", () => {
        const running = replay([runStarted, toolStart("c1", "InternetSearch")]);
        expect(running.steps).toEqual([{ toolCallId: "c1", toolName: "InternetSearch", status: "running", startedAt: 1 }]);
        expect(getRunningStep(running)?.toolName).toBe("InternetSearch");

        const done = reduceRunActivity(running, toolResult("c1"), 5);
        expect(done.steps[0]).toMatchObject({ status: "done", endedAt: 5 });
        expect(getRunningStep(done)).toBeUndefined();
    });

    it("ignores duplicate starts for the same call", () => {
        const state = replay([runStarted, toolStart("c1", "InternetSearch"), toolStart("c1", "InternetSearch")]);
        expect(state.steps).toHaveLength(1);
    });

    it("keeps tracking tools that start after the answer began", () => {
        const state = replay([runStarted, textContent, toolStart("c1", "Brainstorming")]);
        expect(state.phase).toBe("answering");
        expect(getRunningStep(state)?.toolName).toBe("Brainstorming");
    });

    it("returns the most recently started running step", () => {
        const state = replay([runStarted, toolStart("c1", "InternetSearch"), toolStart("c2", "Brainstorming")]);
        expect(getRunningStep(state)?.toolCallId).toBe("c2");
    });

    it("closes open steps when the run finishes", () => {
        const state = replay([runStarted, toolStart("c1", "InternetSearch"), { type: EventType.RUN_FINISHED, threadId: "t", runId: "r" } as BaseEvent]);
        expect(state.phase).toBe("finished");
        expect(state.steps[0].status).toBe("done");
        expect(state.startedAt).toBe(0);
    });

    it("marks open steps as failed when the run errors", () => {
        const state = replay([
            runStarted,
            toolStart("c1", "InternetSearch"),
            toolResult("c1"),
            toolStart("c2", "Brainstorming"),
            { type: EventType.RUN_ERROR, message: "boom" } as BaseEvent
        ]);
        expect(state.phase).toBe("error");
        expect(state.steps.map(step => step.status)).toEqual(["done", "error"]);
    });

    it("ignores unrelated events", () => {
        const state = replay([runStarted]);
        expect(reduceRunActivity(state, { type: EventType.STATE_SNAPSHOT, snapshot: {} } as BaseEvent)).toBe(state);
    });

    it("shows the search query once the streamed arguments are complete", () => {
        const state = replay([
            runStarted,
            toolStart("c1", "InternetSearch"),
            toolArgs("c1", '{"query": "Frist'),
            toolArgs("c1", ' Wohnsitzanmeldung"}'),
            toolEnd("c1")
        ]);
        expect(state.steps[0].detail).toBe("Frist Wohnsitzanmeldung");
        expect(state.steps[0]).not.toHaveProperty("args");
    });

    it("does not show arguments that are not a query", () => {
        const state = replay([runStarted, toolStart("c1", "Simplify"), toolArgs("c1", '{"text": "Ein sehr langer Text"}'), toolResult("c1")]);
        expect(state.steps[0].detail).toBeUndefined();
        expect(state.steps[0]).not.toHaveProperty("args");
    });

    it("drops raw arguments of steps closed by the run end", () => {
        const state = replay([
            runStarted,
            toolStart("c1", "InternetSearch"),
            toolArgs("c1", '{"q": "Kita"}'),
            { type: EventType.RUN_FINISHED, threadId: "t", runId: "r" } as BaseEvent
        ]);
        expect(state.steps[0]).toMatchObject({ status: "done", detail: "Kita" });
        expect(state.steps[0]).not.toHaveProperty("args");
    });
});

describe("getStepsDurationSeconds", () => {
    it("spans from the first start to the last end", () => {
        expect(
            getStepsDurationSeconds([
                { toolCallId: "a", toolName: "x", status: "done", startedAt: 1000, endedAt: 3000 },
                { toolCallId: "b", toolName: "y", status: "done", startedAt: 3000, endedAt: 8400 }
            ])
        ).toBe(7);
    });

    it("is undefined while nothing has ended", () => {
        expect(getStepsDurationSeconds([{ toolCallId: "a", toolName: "x", status: "running", startedAt: 0 }])).toBeUndefined();
    });
});
