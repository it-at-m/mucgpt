import { useCallback } from "react";
import type { MouseEvent } from "react";
import { Button, Tooltip } from "@fluentui/react-components";
import { Checkmark24Regular, QuestionCircle16Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import styles from "./QuestionInput.module.css";
import { ToolListResponse } from "../../api/models";

// Map tool IDs to their tutorial routes
const TOOL_TUTORIAL_MAP: Record<string, string> = {
    Brainstorming: "/tutorials/brainstorm",
    Vereinfachen: "/tutorials/simplify"
    // Add more tool-to-tutorial mappings here as needed
};

interface ToolBadgesProps {
    tools?: ToolListResponse;
    selectedTools: string[];
    allowToolSelection: boolean;
    setSelectedTools?: (tools: string[]) => void;
}

export const ToolBadges = ({ tools, selectedTools, allowToolSelection, setSelectedTools }: ToolBadgesProps) => {
    const { t } = useTranslation();

    const toggleTool = useCallback(
        (toolId: string) => {
            if (!allowToolSelection || !setSelectedTools) return;

            if (selectedTools.includes(toolId)) {
                setSelectedTools(selectedTools.filter(t => t !== toolId));
            } else {
                setSelectedTools([...selectedTools, toolId]);
            }
        },
        [allowToolSelection, selectedTools, setSelectedTools]
    );

    const openTutorial = useCallback((toolId: string, event: MouseEvent) => {
        event.stopPropagation();
        const tutorialRoute = TOOL_TUTORIAL_MAP[toolId];
        if (tutorialRoute) {
            window.open(`#${tutorialRoute}`, "_blank");
        }
    }, []);

    if (!tools || !tools.tools || tools.tools.length === 0) {
        return null;
    }

    return (
        <div className={styles.toolBadgesHeader}>
            <span className={styles.toolBadgesLabel}>{t("components.questioninput.tool_header", "Zusätzliche Tools zu wählen:")}</span>
            {tools.tools.map(tool => {
                const isSelected = selectedTools.includes(tool.id);
                const hasTutorial = TOOL_TUTORIAL_MAP[tool.id];
                return (
                    <div key={tool.id} className={styles.toolButtonWrapper}>
                        <Button
                            appearance={isSelected ? "primary" : "secondary"}
                            size="medium"
                            className={styles.toolButton}
                            onClick={allowToolSelection ? () => toggleTool(tool.id) : undefined}
                            disabled={!allowToolSelection}
                            icon={isSelected ? <Checkmark24Regular /> : undefined}
                        >
                            {tool.id}
                        </Button>
                        {hasTutorial && (
                            <Tooltip content={t("components.questioninput.tutorial_help", "Tutorial öffnen")} relationship="label">
                                <button
                                    className={styles.toolHelpButton}
                                    onClick={e => openTutorial(tool.id, e)}
                                    aria-label={t("components.questioninput.tutorial_help_aria", { tool: tool.id })}
                                >
                                    <QuestionCircle16Regular />
                                </button>
                            </Tooltip>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
