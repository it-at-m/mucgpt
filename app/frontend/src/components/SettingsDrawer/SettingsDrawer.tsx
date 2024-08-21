import { ChevronDown24Regular, DarkTheme20Regular, Dismiss24Regular, FontIncrease20Regular, Mail24Regular } from "@fluentui/react-icons";
import {
    OverlayDrawer,
    Button,
    Slider,
    SliderProps,
    Label,
    useId,
    Tooltip,
    Link
} from "@fluentui/react-components";

import styles from "./SettingsDrawer.module.css";
import { useCallback, useState } from "react";
import { SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";
import { LanguageSelector } from "../../components/LanguageSelector";
import { LLMSelector } from "../LLMSelector/LLMSelector";
import { useTranslation } from 'react-i18next';
import cheetsheet from "../../assets/mucgpt_cheatsheet.pdf";
import { Model } from "../../api";
interface Props {
    onLanguageSelectionChanged: (e: SelectionEvents, selection: OptionOnSelectData) => void;
    defaultlang: string;
    version: string;
    fontscale: number;
    setFontscale: (fontscale: number) => void;
    isLight: boolean;
    setTheme: (isLight: boolean) => void;
    onLLMSelectionChanged: (e: SelectionEvents, selection: OptionOnSelectData) => void;
    defaultLLM: string;
    llmOptions: Model[];
}

export const SettingsDrawer = ({ onLanguageSelectionChanged, defaultlang, version, fontscale, setFontscale, isLight, setTheme, onLLMSelectionChanged, defaultLLM, llmOptions }: Props) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const { t, i18n } = useTranslation();

    const fontscaleID = useId("input-fontscale");
    const feedback_headerID = useId("feedback-language");

    const onClickRightButton = useCallback(() => {
        setIsOpen(true);
    }, [])
    const min_temp = 0.8;
    const max_temp = 1.8;
    const onFontscaleChange: SliderProps["onChange"] = (_, data) =>
        setFontscale(data.value);

    return (
        <div>
            <OverlayDrawer
                size="small"
                position="end"
                open={isOpen}
                style={{ 'padding': "30px", 'alignItems': 'stretch' }}
            >
                <div className={styles.title} role="heading" aria-level={2}>

                    {t('components.settingsdrawer.settings')}
                    <Tooltip content={t('components.settingsdrawer.settings_button_close')} relationship="description" positioning="below">
                        <Button
                            appearance="subtle"
                            aria-label={t('components.settingsdrawer.settings_button_close')}
                            icon={<Dismiss24Regular />}
                            onClick={() => setIsOpen(false)}
                        />
                    </Tooltip>
                </div>
                <div className={styles.header} role="heading" aria-level={3}>
                    {t('components.settingsdrawer.language')}

                </div>
                <div className={styles.bodyContainer}>
                    <LanguageSelector defaultlang={defaultlang} onSelectionChange={onLanguageSelectionChanged}></LanguageSelector>
                </div>

                <div className={styles.header} role="heading" aria-level={3}>
                    {t('components.settingsdrawer.llm')}
                </div>
                <div className={styles.bodyContainer}>
                    <LLMSelector defaultLLM={defaultLLM} onSelectionChange={onLLMSelectionChanged} options={llmOptions}></LLMSelector>
                </div>
                <div className={styles.header} role="heading" aria-level={3}>
                    {t('components.settingsdrawer.fontsize')}
                </div>
                <div className={styles.bodyContainer}>
                    <div className={styles.verticalContainer}>

                        <Tooltip aria-hidden="true" content={t('components.settingsdrawer.change_font')} relationship="description" positioning="below">
                            <FontIncrease20Regular className={styles.iconRightMargin} ></FontIncrease20Regular>
                        </Tooltip>
                        <Slider min={min_temp}
                            max={max_temp}
                            defaultValue={2}
                            onChange={onFontscaleChange}
                            aria-valuetext={t('components.settingsdrawer.fontsize') + ` ist ${Math.floor(fontscale * 100)} %`}
                            value={fontscale}
                            step={0.1}
                            size="small"
                            aria-label={t('components.settingsdrawer.change_font')}
                            id={fontscaleID} />
                        <br></br>
                        <Label htmlFor={fontscaleID} aria-hidden>
                            {Math.floor(fontscale * 100)} %
                        </Label>
                    </div>

                </div>
                <div className={styles.header} role="heading" aria-level={3}>
                    {t('components.settingsdrawer.theme')}
                </div>
                <div className={styles.bodyContainer}>
                    <div className={styles.verticalContainer}>

                        <Tooltip content={t('components.settingsdrawer.change_theme')} relationship="description" positioning="below">

                            <Button appearance="subtle" aria-label={t('components.settingsdrawer.change_theme')} icon={<DarkTheme20Regular className={styles.iconRightMargin} ></DarkTheme20Regular>} onClick={() => setTheme(!isLight)} size="large">
                            </Button>
                        </Tooltip>


                        {isLight ? (<div>{t('components.settingsdrawer.theme_light')}</div>) : (<div>{t('components.settingsdrawer.theme_dark')}</div>)}
                    </div>
                </div>
                <div className={styles.header} role="heading" aria-level={3} id={feedback_headerID}>
                    {t('components.settingsdrawer.feedback')}

                </div>
                <div className={styles.bodyContainer} role="heading" aria-level={3}>
                    <div className={styles.verticalContainer}>
                        <Mail24Regular className={styles.iconRightMargin} aria-hidden ></Mail24Regular>
                        <Link aria-labelledby={feedback_headerID} href="mailto:itm.kicc@muenchen.de?subject=MUCGPT">
                            itm.kicc@muenchen.de
                        </Link>
                    </div>
                </div>
                <div className={styles.header} role="heading" aria-level={3}>
                    {t('components.settingsdrawer.help')}

                </div>
                <div className={styles.bodyContainer}>
                    <ul className={styles.list}>
                        <li>  <Link href="\#faq">
                            FAQs
                        </Link></li>
                        <li>
                            <Link download href={cheetsheet} aria-label="Cheat Sheet">
                                Cheat Sheet
                            </Link>
                        </li>
                    </ul>
                </div>
                <div className={styles.header} role="heading" aria-level={3}>
                    {t('components.settingsdrawer.about')}
                </div>
                <div className={styles.bodyContainer}>
                    <div className={styles.faq}>Version: {version} </div>
                    <div className={styles.faq}>
                        <Link href="\#version">
                            {t('version.header')}
                        </Link>
                    </div>
                </div>
            </OverlayDrawer >

            <div className={styles.button}>
                <Button icon={<ChevronDown24Regular />} appearance="primary" onClick={onClickRightButton}>
                    {t('components.settingsdrawer.settings_button')}
                </Button>
            </div>
        </div >
    );
};
