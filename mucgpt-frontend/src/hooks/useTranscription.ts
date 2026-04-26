import { useContext } from "react";
import { TranscriptionSettingsContext, type ITranscriptionSettings } from "../components/TranscriptionSettings/TranscriptionSettingsContext";

export type { TranscriptionStatus, TranscriptionLanguage } from "../components/TranscriptionSettings/TranscriptionSettingsContext";

export function useTranscription(): ITranscriptionSettings {
    return useContext(TranscriptionSettingsContext);
}
