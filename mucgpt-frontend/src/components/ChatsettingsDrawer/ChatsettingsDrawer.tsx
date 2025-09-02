import { Settings24Regular } from "@fluentui/react-icons";
import { Accordion, AccordionHeader, AccordionItem, AccordionPanel, AccordionToggleEventHandler } from "@fluentui/react-components";

import styles from "./ChatsettingsDrawer.module.css";
import { ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sidebar } from "../Sidebar/Sidebar";
import { ChatSettingsContent } from "./ChatSettingsContent";

const SETTINGS_ACCORDION_STATE = "SETTINGS_ACCORDION_STATE";

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
    const { t } = useTranslation();
    const [openItems, setOpenItems] = useState<string | string[]>(() => {
        const storedState = localStorage.getItem(SETTINGS_ACCORDION_STATE);
        // Default to open if no stored state
        return storedState ? JSON.parse(storedState) : ["advanced"];
    });

    const handleToggle: AccordionToggleEventHandler<string> = (event, data) => {
        setOpenItems(data.openItems);
        localStorage.setItem(SETTINGS_ACCORDION_STATE, JSON.stringify(data.openItems));
    }; // sidebar action and content    // No longer using sidebarAction as we've moved actions below the title
    const sidebarAction = null;
    const sidebarContent = (
        <div className={styles.settingsContent}>
            {" "}
            {/* Title Section with cleaner layout */}
            <div className={styles.titleSection}>
                <h3 className={styles.settingsTitle}>
                    <Settings24Regular className={styles.icon} aria-hidden="true" />
                    {t("components.chattsettingsdrawer.title", "Chat Einstellungen")}
                </h3>

                {/* Actions below title */}
                <div className={styles.actionRow}>{actions}</div>
            </div>
            {/* Additional content first - improved spacing */}
            {content && <div className={styles.contentSection}>{content}</div>}
            {/* Chat Settings Overview Section */}
            <div className={styles.actionSection}>
                <Accordion collapsible={true} openItems={openItems} onToggle={handleToggle}>
                    <AccordionItem value="advanced">
                        <AccordionHeader>{t("components.chattsettingsdrawer.advanced_settings", "Erweiterte Einstellungen")}</AccordionHeader>
                        <AccordionPanel>
                            <ChatSettingsContent
                                temperature={temperature}
                                setTemperature={setTemperature}
                                max_output_tokens={max_output_tokens}
                                setMaxTokens={setMaxTokens}
                                systemPrompt={systemPrompt}
                                setSystemPrompt={setSystemPrompt}
                            />
                        </AccordionPanel>
                    </AccordionItem>
                </Accordion>
            </div>
        </div>
    );

    return <Sidebar actions={sidebarAction} content={sidebarContent}></Sidebar>;
};
