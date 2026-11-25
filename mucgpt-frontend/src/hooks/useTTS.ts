import { useContext } from "react";
import { TtsContext, type ITts } from "../components/TTS/TTSContext";

export type { TtsStatus, ITts } from "../components/TTS/TTSContext";

/** Access hook for the read-aloud state and actions (context re-export). */
export function useTTS(): ITts {
    return useContext(TtsContext);
}
