import { Speaker224Regular, Stop24Regular } from "@fluentui/react-icons";
import { Tooltip } from "@fluentui/react-components";
import { useId, useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "../../ui/Button";
import { useTTS } from "../../hooks/useTTS";
import { markdownToSpeechText } from "../../utils/tts/markdownToSpeechText";

interface Props {
    /** The raw answer markdown; code/tables/formulas are stripped before synthesis. */
    text: string;
    disabled?: boolean;
}

/**
 * Read-aloud toggle for one assistant answer, shown in the answer's action
 * row. Hidden entirely when the feature is disabled or the answer carries no
 * speakable prose (e.g. a pure code answer). The PoC runtime speaks English
 * only; the button stays available regardless of interface language.
 */
export const ReadAloudButton = ({ text, disabled = false }: Props) => {
    const { t } = useTranslation();
    const { enabled, status, modelProgress, activeToken, speak, stop } = useTTS();
    // Stable per-instance token: the provider tracks the currently spoken
    // answer by this token (ChatResponse carries no message id).
    const token = useId();
    const speechText = useMemo(() => (enabled ? markdownToSpeechText(text) : ""), [enabled, text]);

    if (!enabled || !speechText) return null;

    const isMine = (status === "loading" || status === "speaking") && activeToken === token;
    const isSpeaking = isMine && status === "speaking";
    const isLoading = isMine && status === "loading";

    const getTooltipContent = () => {
        if (isLoading) return `${t("components.answer.read_aloud_loading")}${modelProgress > 0 ? ` ${modelProgress}%` : ""}`;
        if (isSpeaking) return t("components.answer.read_aloud_stop");
        return t("components.answer.read_aloud");
    };
    const tooltip = getTooltipContent();

    return (
        <Tooltip content={tooltip} relationship="description" positioning="above">
            <Button
                appearance="subtle"
                aria-label={tooltip}
                aria-pressed={isSpeaking}
                disabled={disabled || isLoading}
                icon={isSpeaking ? <Stop24Regular /> : <Speaker224Regular />}
                size="small"
                onClick={() => {
                    if (isMine) {
                        stop();
                    } else {
                        speak(token, speechText);
                    }
                }}
            />
        </Tooltip>
    );
};
