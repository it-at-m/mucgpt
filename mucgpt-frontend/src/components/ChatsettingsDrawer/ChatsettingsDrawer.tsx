import { ChevronDown20Regular, ChevronRight20Regular, Settings24Regular } from "@fluentui/react-icons";
import { useId } from "@fluentui/react-components";

import styles from "./ChatsettingsDrawer.module.css";
import { useState } from "react";
import { ChatSettingsContent } from "./ChatSettingsContent";
interface Props {
    temperature: number;
    setTemperature: (temp: number) => void;
    max_output_tokens: number;
    setMaxTokens: (maxTokens: number) => void;
    systemPrompt: string;
    setSystemPrompt: (systemPrompt: string) => void;
}

export const ChatsettingsDrawer = ({ temperature, setTemperature, max_output_tokens, setMaxTokens, systemPrompt, setSystemPrompt }: Props) => {
    // State for collapsible sections
    const [isOverviewExpanded, setIsOverviewExpanded] = useState<boolean>(false);

    const overviewID = useId("header-overview");

    // Toggle overview section visibility
    const toggleOverview = (e?: React.MouseEvent | React.KeyboardEvent) => {
        if (e) {
            e.stopPropagation();
        }
        setIsOverviewExpanded(prev => !prev);
    };

    return (
        <div className={styles.settingsContent}>
            {/* Chat Settings Overview Section */}
            <div className={styles.actionSection}>
                <div
                    className={styles.header}
                    role="heading"
                    aria-level={2}
                    id={overviewID}
                    onClick={e => toggleOverview(e)}
                    tabIndex={0}
                    onKeyDown={e => e.key === "Enter" && toggleOverview(e)}
                    aria-expanded={isOverviewExpanded}
                >
                    <div className={styles.headerContent}>
                        <Settings24Regular />
                        <span>Chat Einstellungen</span>
                    </div>
                    <div className={styles.expandCollapseIcon}>{isOverviewExpanded ? <ChevronDown20Regular /> : <ChevronRight20Regular />}</div>
                </div>

                {/* The Collapse component */}
                {isOverviewExpanded && (
                    <div className={styles.collapseContent}>
                        <ChatSettingsContent
                            temperature={temperature}
                            setTemperature={setTemperature}
                            max_output_tokens={max_output_tokens}
                            setMaxTokens={setMaxTokens}
                            systemPrompt={systemPrompt}
                            setSystemPrompt={setSystemPrompt}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
