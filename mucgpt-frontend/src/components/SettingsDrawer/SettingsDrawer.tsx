import { ChevronDown24Regular, DarkTheme20Regular, Dismiss24Regular, FontIncrease20Regular, Mail24Regular } from "@fluentui/react-icons";
import { OverlayDrawer, Button, Slider, SliderProps, Label, useId, Tooltip, Link } from "@fluentui/react-components";

import styles from "./SettingsDrawer.module.css";
import { useCallback, useState } from "react";
import { SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";
import { Tag } from "@fluentui/react-components";
import { LanguageSelector } from "../../components/LanguageSelector";
import { LLMSelector } from "../LLMSelector/LLMSelector";
import { useTranslation } from "react-i18next";
import { Model } from "../../api";
interface Props {
    onLanguageSelectionChanged: (e: SelectionEvents, selection: OptionOnSelectData) => void;
    defaultlang: string;
    version: string;
    commit: string;
    fontscale: number;
    setFontscale: (fontscale: number) => void;
    isLight: boolean;
    setTheme: (isLight: boolean) => void;
    onLLMSelectionChanged: (e: SelectionEvents, selection: OptionOnSelectData) => void;
    defaultLLM: string;
    llmOptions: Model[];
    currentLLM: Model;
}

export const SettingsDrawer = ({
    onLanguageSelectionChanged,
    defaultlang,
    version,
    commit,
    fontscale,
    setFontscale,
    isLight,
    setTheme,
    onLLMSelectionChanged,
    defaultLLM,
    llmOptions,
    currentLLM
}: Props) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const { t } = useTranslation();

    const fontscaleID = useId("input-fontscale");
    const feedback_headerID = useId("feedback-language");

    const min_temp = 0.8;
    const max_temp = 1.8;

    // open settings drawer
    const onClickRightButton = useCallback(() => {
        setIsOpen(true);
    }, []);

    // change font size
    const onFontscaleChange: SliderProps["onChange"] = useCallback((_: any, data: { value: number }) => setFontscale(data.value), [setFontscale]);

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
                    {t("components.settingsdrawer.language")}
                </div>
                <div className={styles.bodyContainer}>
                    <LanguageSelector defaultlang={defaultlang} onSelectionChange={onLanguageSelectionChanged}></LanguageSelector>
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
                <div className={styles.bodyContainer}>
                    <div className={styles.verticalContainer}>
                        <Tooltip aria-hidden="true" content={t("components.settingsdrawer.change_font")} relationship="description" positioning="below">
                            <FontIncrease20Regular className={styles.iconRightMargin}></FontIncrease20Regular>
                        </Tooltip>
                        <Slider
                            min={min_temp}
                            max={max_temp}
                            onChange={onFontscaleChange}
                            aria-valuetext={t("components.settingsdrawer.fontsize") + ` ist ${Math.floor(fontscale * 100)} %`}
                            value={fontscale}
                            step={0.1}
                            size="small"
                            aria-label={t("components.settingsdrawer.change_font")}
                            id={fontscaleID}
                        />
                        <br></br>
                        <Label htmlFor={fontscaleID} aria-hidden>
                            {Math.floor(fontscale * 100)} %
                        </Label>
                    </div>
                </div>
                <div className={styles.header} role="heading" aria-level={3}>
                    {t("components.settingsdrawer.theme")}
                </div>
                <div className={styles.bodyContainer}>
                    <div className={styles.verticalContainer}>
                        <Tooltip content={t("components.settingsdrawer.change_theme")} relationship="description" positioning="below">
                            <Button
                                appearance="subtle"
                                aria-label={t("components.settingsdrawer.change_theme")}
                                icon={<DarkTheme20Regular className={styles.iconRightMargin}></DarkTheme20Regular>}
                                onClick={() => setTheme(!isLight)}
                                size="large"
                            ></Button>
                        </Tooltip>

                        {isLight ? <div>{t("components.settingsdrawer.theme_light")}</div> : <div>{t("components.settingsdrawer.theme_dark")}</div>}
                    </div>
                </div>
                <div className={styles.header} role="heading" aria-level={3} id={feedback_headerID}>
                    {t("components.settingsdrawer.feedback")}
                </div>
                <div className={styles.bodyContainer} role="heading" aria-level={3}>
                    <div className={styles.verticalContainer}>
                        <Mail24Regular className={styles.iconRightMargin} aria-hidden></Mail24Regular>
                        <Link aria-labelledby={feedback_headerID} href="mailto:itm.kicc@muenchen.de?subject=MUCGPT">
                            itm.kicc@muenchen.de
                        </Link>
                    </div>
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
                <div className={styles.header} role="heading" aria-level={3}>
                    {t("components.settingsdrawer.about")}
                </div>
                <div className={styles.bodyContainer}>
                    <div className={styles.faq}>
                        Version: <Tag shape="circular">{version}</Tag> <Tag shape="circular">{commit}</Tag>
                    </div>
                    <div className={styles.faq}>
                        <Link href={import.meta.env.BASE_URL + `#/version`} onClick={closeDrawer}>
                            {t("version.header")}
                        </Link>
                    </div>
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
