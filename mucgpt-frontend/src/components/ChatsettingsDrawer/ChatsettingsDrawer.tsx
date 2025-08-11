import { ChevronDown20Regular, ChevronRight20Regular, Settings24Regular } from "@fluentui/react-icons";
import { useId } from "@fluentui/react-components";

import styles from "./ChatsettingsDrawer.module.css";
import { ReactNode, useState } from "react";
import { Sidebar } from "../Sidebar/Sidebar";
import { ChatSettingsContent } from "./ChatSettingsContent";
interface Props {
    temperature: number;
    setTemperature: (temp: number) => void;
    max_output_tokens: number;
    setMaxTokens: (maxTokens: number) => void;
    systemPrompt: string;
    setSystemPrompt: (systemPrompt: string) => void;
    actions: ReactNode;
    content: ReactNode;
}

export const ChatsettingsDrawer = ({
    temperature,
    setTemperature,
    max_output_tokens,
    setMaxTokens,
    systemPrompt,
    setSystemPrompt,
    actions,
    content
}: Props) => {
    // State for collapsible sections
    const [isOverviewExpanded, setIsOverviewExpanded] = useState<boolean>(true);

    const overviewID = useId("header-overview");

    // Toggle overview section visibility
    const toggleOverview = (e?: React.MouseEvent | React.KeyboardEvent) => {
        if (e) {
            e.stopPropagation();
        }
        setIsOverviewExpanded(prev => !prev);
    };

    // sidebar action and content
    const sidebar_action = <div className={styles.actionRow}>{actions}</div>;
    const sidebar_content = (
        <div className={styles.settingsContent}>
            {/* Title Section */}
            <div className={styles.titleSection}>
                <h3 className={styles.settingsTitle}>
                    <Settings24Regular className={styles.icon} aria-hidden="true" />
                    Chat Einstellungen
                </h3>
            </div>

            {/* Additional content first */}
            {content && <div className={styles.contentSection}>{content}</div>}

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
                        <span>Erweiterte Einstellungen</span>
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

    return <Sidebar actions={sidebar_action} content={sidebar_content}></Sidebar>;
};
