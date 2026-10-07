import { EventType, type BaseEvent, type ToolCallArgsEvent, type ToolCallEndEvent, type ToolCallResultEvent, type ToolCallStartEvent } from "@ag-ui/core";

export type ActivityStepStatus = "running" | "done" | "error";

export interface ActivityStep {
    toolCallId: string;
    toolName: string;
    status: ActivityStepStatus;
    startedAt: number;
    endedAt?: number;
    /** Short user-facing hint of what the tool was asked, e.g. the search query. */
    detail?: string;
    /** Raw streamed tool arguments; only kept until the call's arguments are complete. */
    args?: string;
}

/** User-facing view of an AG-UI run: what the agent is doing right now and which tool steps it took. */
export interface RunActivity {
    phase: "idle" | "thinking" | "answering" | "finished" | "error";
    steps: ActivityStep[];
    /** When the run started; drives the elapsed-time counter while the user waits for the answer. */
    startedAt?: number;
}

export const initialRunActivity: RunActivity = { phase: "idle", steps: [] };

// Argument names whose value tells the user what a tool is looking for. Other arguments
// (e.g. the full text handed to "simplify") are not meant to be shown.
const DETAIL_ARGUMENT_KEYS = ["query", "search_query", "q", "topic"];
const MAX_DETAIL_LENGTH = 120;

const toDetail = (args: string | undefined): string | undefined => {
    if (!args) return undefined;
    let parsed: unknown;
    try {
        parsed = JSON.parse(args);
    } catch {
        return undefined;
    }
    if (!parsed || typeof parsed !== "object") return undefined;
    const record = parsed as Record<string, unknown>;
    const value = DETAIL_ARGUMENT_KEYS.map(key => record[key]).find(
        (candidate): candidate is string => typeof candidate === "string" && candidate.trim() !== ""
    );
    if (!value) return undefined;
    const singleLine = value.replace(/\s+/g, " ").trim();
    return singleLine.length > MAX_DETAIL_LENGTH ? `${singleLine.slice(0, MAX_DETAIL_LENGTH - 1)}…` : singleLine;
};

/** Turns the streamed arguments into the display detail and drops the raw arguments. */
const settleArgs = ({ args, ...step }: ActivityStep): ActivityStep => {
    const detail = step.detail ?? toDetail(args);
    return detail ? { ...step, detail } : step;
};

const updateStep = (steps: ActivityStep[], toolCallId: string, update: (step: ActivityStep) => ActivityStep) =>
    steps.map(step => (step.toolCallId === toolCallId ? update(step) : step));

const finishRunningSteps = (steps: ActivityStep[], status: ActivityStepStatus, now: number) =>
    steps.map(step => (step.status === "running" ? settleArgs({ ...step, status, endedAt: now }) : step));

/**
 * Folds one AG-UI event into the run activity. Pure, so it can be used both
 * while streaming and to rebuild the activity from a recorded event log.
 */
export const reduceRunActivity = (state: RunActivity, event: BaseEvent, now: number = Date.now()): RunActivity => {
    switch (event.type) {
        case EventType.RUN_STARTED:
            // Keep a start time set when the request was sent: that is the wait the user feels.
            return { phase: "thinking", steps: [], startedAt: state.startedAt ?? now };
        case EventType.TOOL_CALL_START: {
            const { toolCallId, toolCallName } = event as ToolCallStartEvent;
            if (state.steps.some(step => step.toolCallId === toolCallId)) return state;
            return { ...state, steps: [...state.steps, { toolCallId, toolName: toolCallName, status: "running", startedAt: now }] };
        }
        case EventType.TOOL_CALL_ARGS: {
            const { toolCallId, delta } = event as ToolCallArgsEvent;
            return {
                ...state,
                steps: updateStep(state.steps, toolCallId, step => (step.status === "running" ? { ...step, args: (step.args ?? "") + delta } : step))
            };
        }
        case EventType.TOOL_CALL_END: {
            const { toolCallId } = event as ToolCallEndEvent;
            return { ...state, steps: updateStep(state.steps, toolCallId, settleArgs) };
        }
        case EventType.TOOL_CALL_RESULT: {
            const { toolCallId } = event as ToolCallResultEvent;
            return {
                ...state,
                steps: updateStep(state.steps, toolCallId, step => (step.status === "running" ? settleArgs({ ...step, status: "done", endedAt: now }) : step))
            };
        }
        case EventType.TEXT_MESSAGE_START:
        case EventType.TEXT_MESSAGE_CONTENT:
        case EventType.TEXT_MESSAGE_CHUNK:
            return state.phase === "answering" ? state : { ...state, phase: "answering" };
        case EventType.RUN_FINISHED:
            return { ...state, phase: "finished", steps: finishRunningSteps(state.steps, "done", now) };
        case EventType.RUN_ERROR:
            return { ...state, phase: "error", steps: finishRunningSteps(state.steps, "error", now) };
        default:
            return state;
    }
};

/** The tool step the agent is currently waiting on, if any (the most recently started one). */
export const getRunningStep = (activity: RunActivity): ActivityStep | undefined => activity.steps.findLast(step => step.status === "running");

/** Wall-clock time from the first tool start to the last tool end, in whole seconds. */
export const getStepsDurationSeconds = (steps: ActivityStep[]): number | undefined => {
    const ended = steps.flatMap(step => (step.endedAt === undefined ? [] : [step.endedAt]));
    if (steps.length === 0 || ended.length === 0) return undefined;
    const start = Math.min(...steps.map(step => step.startedAt));
    return Math.round((Math.max(...ended) - start) / 1000);
};
