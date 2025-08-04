import { ChevronDown24Regular, Dismiss24Regular } from "@fluentui/react-icons";
import { OverlayDrawer, Button, Tooltip, Link } from "@fluentui/react-components";

import styles from "./SettingsDrawer.module.css";
import { useCallback, useState } from "react";
import { SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";
import { LLMSelector } from "../LLMSelector/LLMSelector";
import { useTranslation } from "react-i18next";
import { Model } from "../../api";
interface Props {
    onLLMSelectionChanged: (e: SelectionEvents, selection: OptionOnSelectData) => void;
    defaultLLM: string;
    llmOptions: Model[];
    currentLLM: Model;
}

export const SettingsDrawer = ({ onLLMSelectionChanged, defaultLLM, llmOptions, currentLLM }: Props) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const { t } = useTranslation();

    // open settings drawer
    const onClickRightButton = useCallback(() => {
        setIsOpen(true);
    }, []);

    // close settings drawer
    const closeDrawer = useCallback(() => {
        setIsOpen(false);
    }, []);

    return (
        <div>
            <OverlayDrawer size="small" position="end" open={isOpen} style={{ padding: "30px", alignItems: "stretch", overflowY: "auto", height: "100vh" }}>
                <div className={styles.title} role="heading" aria-level={2}>
                    <div className={styles.title_text}>{t("components.settingsdrawer.settings")}</div>
                    <div className={styles.title_close}>
                        <Tooltip content={t("components.settingsdrawer.settings_button_close")} relationship="description" positioning="below">
                            <Button
                                appearance="subtle"
                                aria-label={t("components.settingsdrawer.settings_button_close")}
                                icon={<Dismiss24Regular />}
                                onClick={closeDrawer}
                            />
                        </Tooltip>
                    </div>
                </div>
                <div className={styles.header} role="heading" aria-level={3}>
                    {t("components.settingsdrawer.llm")}
                </div>
                <div className={styles.bodyContainer}>
                    <LLMSelector defaultLLM={defaultLLM} onSelectionChange={onLLMSelectionChanged} options={llmOptions}></LLMSelector>
                    <div className={styles.info}>{currentLLM["description"]}</div>
                </div>
                <div className={styles.header} role="heading" aria-level={3}>
                    {t("components.settingsdrawer.fontsize")}
                </div>
                <div className={styles.header} role="heading" aria-level={3}>
                    {t("components.settingsdrawer.theme")}
                </div>
                <div className={styles.header} role="heading" aria-level={3}>
                    {t("components.settingsdrawer.help")}
                </div>
                <div className={styles.bodyContainer}>
                    <ul className={styles.list}>
                        <li>
                            {" "}
                            <Link href={import.meta.env.BASE_URL + "#/faq"} onClick={closeDrawer}>
                                FAQs
                            </Link>
                        </li>
                    </ul>
                </div>
            </OverlayDrawer>

            <div className={styles.button}>
                <Button icon={<ChevronDown24Regular />} appearance="primary" onClick={onClickRightButton}>
                    {t("components.settingsdrawer.settings_button")}
                </Button>
            </div>
        </div>
    );
};
