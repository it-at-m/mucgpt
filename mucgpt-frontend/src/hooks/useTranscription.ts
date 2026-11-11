import { useContext } from "react";
import { TranscriptionContext, type ITranscription } from "../components/Transcription/TranscriptionContext";

export type { TranscriptionStatus, TranscriptionModelState, TranscriptionLanguage, ITranscription } from "../components/Transcription/TranscriptionContext";

/** Access hook for the transcription model state, status and actions (context re-export). */
export function useTranscription(): ITranscription {
    return useContext(TranscriptionContext);
}
