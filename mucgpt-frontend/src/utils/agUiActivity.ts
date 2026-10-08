import { EventType, type BaseEvent, type ToolCallArgsEvent, type ToolCallEndEvent, type ToolCallResultEvent, type ToolCallStartEvent } from "@ag-ui/core";

export type ActivityStepStatus = "running" | "done" | "error";

export interface ActivityStep {
    toolCallId: string;
    toolName: string;
    status: ActivityStepStatus;
    startedAt: number;
    endedAt?: number;
    /** The model's own one-line description of what it does with this call (its `status_message` argument). */
    description?: string;
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
const DETAIL_ARGUMENT_KEYS = ["query", "search_query", "q", "topic", "url"];
const MAX_DETAIL_LENGTH = 120;
// Added to every tool by the core service's ToolStatusMiddleware; streamed as the first argument.
const STATUS_ARGUMENT_KEY = "status_message";
const MAX_DESCRIPTION_LENGTH = 80;
// Matches the finished status string inside still-incomplete argument JSON.
const STATUS_ARGUMENT_PATTERN = new RegExp(`"${STATUS_ARGUMENT_KEY}"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*")`);

const toDisplayText = (value: string, maxLength: number): string | undefined => {
    const singleLine = value.replace(/\s+/g, " ").trim();
    if (!singleLine) return undefined;
    return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength - 1)}…` : singleLine;
};

/** Reads the status description as soon as its string is complete, before the rest of the arguments arrive. */
const toDescription = (args: string): string | undefined => {
    const match = STATUS_ARGUMENT_PATTERN.exec(args);
    if (!match) return undefined;
    try {
        const value: unknown = JSON.parse(match[1]);
        return typeof value === "string" ? toDisplayText(value, MAX_DESCRIPTION_LENGTH) : undefined;
    } catch {
        return undefined;
    }
};

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
    return value ? toDisplayText(value, MAX_DETAIL_LENGTH) : undefined;
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
                steps: updateStep(state.steps, toolCallId, step => {
                    if (step.status !== "running") return step;
                    const args = (step.args ?? "") + delta;
                    const description = step.description ?? toDescription(args);
                    return description ? { ...step, args, description } : { ...step, args };
                })
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

/** What the live loading line says: a tool step, reviewing tool results, or a thinking stage. */
export type LiveStatus = { kind: "thinking"; stage: number } | { kind: "evaluating" } | { kind: "tool"; step: ActivityStep; awaitingDescription: boolean };

/** Seconds into the run at which the thinking message escalates to the next stage. */
export const THINKING_STAGE_STARTS_SECONDS = [0, 10, 25];
// The model streams its status description first; wait this long for it before falling back to the tool name.
const DESCRIPTION_GRACE_MS = 500;

/** Derives the live status. Internal tools (see `isVisibleTool`) never show up. */
export const getLiveStatus = (activity: RunActivity | undefined, now: number, isVisibleTool: (toolName: string) => boolean): LiveStatus => {
    const steps = activity?.steps.filter(step => isVisibleTool(step.toolName)) ?? [];
    const running = steps.findLast(step => step.status === "running");
    if (running) {
        return { kind: "tool", step: running, awaitingDescription: !running.description && now - running.startedAt < DESCRIPTION_GRACE_MS };
    }
    if (steps.length > 0) return { kind: "evaluating" };
    const elapsedSeconds = activity?.startedAt === undefined ? 0 : (now - activity.startedAt) / 1000;
    return {
        kind: "thinking",
        stage: Math.max(
            0,
            THINKING_STAGE_STARTS_SECONDS.findLastIndex(start => elapsedSeconds >= start)
        )
    };
};

/** Identity of what the status line shows; a change of key is a visible change of the line. */
export const getLiveStatusKey = (status: LiveStatus): string => {
    if (status.kind === "thinking") return `thinking:${status.stage}`;
    if (status.kind === "evaluating") return "evaluating";
    return `tool:${status.step.toolCallId}:${status.step.description ?? ""}`;
};

/** Wall-clock time from the first tool start to the last tool end, in whole seconds. */
export const getStepsDurationSeconds = (steps: ActivityStep[]): number | undefined => {
    const ended = steps.flatMap(step => (step.endedAt === undefined ? [] : [step.endedAt]));
    if (steps.length === 0 || ended.length === 0) return undefined;
    const start = Math.min(...steps.map(step => step.startedAt));
    return Math.round((Math.max(...ended) - start) / 1000);
};
