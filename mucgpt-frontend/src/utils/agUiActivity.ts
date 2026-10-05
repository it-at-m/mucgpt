import { EventType, type BaseEvent, type ToolCallResultEvent, type ToolCallStartEvent } from "@ag-ui/core";

export type ActivityStepStatus = "running" | "done" | "error";

export interface ActivityStep {
    toolCallId: string;
    toolName: string;
    status: ActivityStepStatus;
    startedAt: number;
    endedAt?: number;
}

/** User-facing view of an AG-UI run: what the agent is doing right now and which tool steps it took. */
export interface RunActivity {
    phase: "idle" | "thinking" | "answering" | "finished" | "error";
    steps: ActivityStep[];
}

export const initialRunActivity: RunActivity = { phase: "idle", steps: [] };

const finishRunningSteps = (steps: ActivityStep[], status: ActivityStepStatus, now: number) =>
    steps.map(step => (step.status === "running" ? { ...step, status, endedAt: now } : step));

/**
 * Folds one AG-UI event into the run activity. Pure, so it can be used both
 * while streaming and to rebuild the activity from a recorded event log.
 */
export const reduceRunActivity = (state: RunActivity, event: BaseEvent, now: number = Date.now()): RunActivity => {
    switch (event.type) {
        case EventType.RUN_STARTED:
            return { phase: "thinking", steps: [] };
        case EventType.TOOL_CALL_START: {
            const { toolCallId, toolCallName } = event as ToolCallStartEvent;
            if (state.steps.some(step => step.toolCallId === toolCallId)) return state;
            return { ...state, steps: [...state.steps, { toolCallId, toolName: toolCallName, status: "running", startedAt: now }] };
        }
        case EventType.TOOL_CALL_RESULT: {
            const { toolCallId } = event as ToolCallResultEvent;
            return {
                ...state,
                steps: state.steps.map(step => (step.toolCallId === toolCallId && step.status === "running" ? { ...step, status: "done", endedAt: now } : step))
            };
        }
        case EventType.TEXT_MESSAGE_START:
        case EventType.TEXT_MESSAGE_CONTENT:
        case EventType.TEXT_MESSAGE_CHUNK:
            return state.phase === "answering" ? state : { ...state, phase: "answering" };
        case EventType.RUN_FINISHED:
            return { phase: "finished", steps: finishRunningSteps(state.steps, "done", now) };
        case EventType.RUN_ERROR:
            return { phase: "error", steps: finishRunningSteps(state.steps, "error", now) };
        default:
            return state;
    }
};

/** The tool step the agent is currently waiting on, if any (the most recently started one). */
export const getRunningStep = (activity: RunActivity): ActivityStep | undefined => activity.steps.findLast(step => step.status === "running");
