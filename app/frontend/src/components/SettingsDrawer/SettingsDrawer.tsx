import { ChevronDown24Regular, DarkTheme20Regular, Dismiss24Regular, FontIncrease20Regular, Mail24Regular } from "@fluentui/react-icons";
import {
    DrawerHeader,
    DrawerHeaderTitle,
    OverlayDrawer,
    Button,
    Divider,
    CheckboxOnChangeData,
    CheckboxProps,
    Slider,
    SliderProps,
    Label,
    useId,
    Tooltip,
    Link
} from "@fluentui/react-components";

import styles from "./SettingsDrawer.module.css";
import { ChangeEvent, Dispatch, SetStateAction, useCallback, useState } from "react";
import { SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";
import { LanguageSelector } from "../../components/LanguageSelector";
import { useTranslation } from 'react-i18next';
import { Checkbox } from "@fluentui/react-components";
interface Props {
    onLanguageSelectionChanged: (e: SelectionEvents, selection: OptionOnSelectData) => void;
    defaultlang: string;
    version: string;
    enableSnow: CheckboxProps["checked"];
    onEnableSnowChanged: (ev: ChangeEvent<HTMLInputElement>, data: CheckboxOnChangeData) => void;
    fontscale: number;
    setFontscale: (fontscale: number) => void;
    isLight: boolean;
    setTheme: (isLight: boolean) => void;
}

export const SettingsDrawer = ({ onLanguageSelectionChanged, defaultlang, version, enableSnow, onEnableSnowChanged, fontscale, setFontscale, isLight, setTheme }: Props) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const { t, i18n } = useTranslation();

    const fontscaleID = useId("input-fontscale");

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
                <div className={styles.header}>
                    <DrawerHeader>
                        <DrawerHeaderTitle
                            action={
                                <Button
                                    appearance="subtle"
                                    aria-label="Close"
                                    icon={<Dismiss24Regular />}
                                    onClick={() => setIsOpen(false)}
                                />
                            }
                        >
                            {t('components.settingsdrawer.settings')}
                        </DrawerHeaderTitle>
                    </DrawerHeader>
                </div>
                <div className={styles.header}>
                    Sprache

                </div>
                <div className={styles.bodyContainer}>
                    <LanguageSelector defaultlang={defaultlang} onSelectionChange={onLanguageSelectionChanged} ></LanguageSelector>
                </div>
                <div className={styles.header}>
                    Schriftgröße

                </div>
                <div className={styles.bodyContainer}>
                    <div className={styles.verticalContainer}>

                        <Tooltip content="Schriftgröße anpassen" relationship="description" positioning="below">
                            <FontIncrease20Regular className={styles.iconRightMargin} ></FontIncrease20Regular>
                        </Tooltip>
                        <Slider min={min_temp}
                            max={max_temp}
                            defaultValue={2}
                            onChange={onFontscaleChange}
                            aria-valuetext={`Value is ${fontscale}`}
                            value={fontscale}
                            rail={{ style: { backgroundColor: "black" } }}
                            thumb={{ style: { backgroundColor: "black" } }}
                            step={0.1}
                            size="small"
                            id={fontscaleID} />
                        <br></br>
                        <Label htmlFor={fontscaleID}>
                            {Math.floor(fontscale * 100)} %
                        </Label>
                    </div>

                </div>
                <div className={styles.header}>
                    Design
                </div>
                <div className={styles.bodyContainer}>
                    <div className={styles.verticalContainer}>

                        <Tooltip content="Design wechseln" relationship="description" positioning="below">

                            <Button appearance="subtle" icon={<DarkTheme20Regular className={styles.iconRightMargin} ></DarkTheme20Regular>} onClick={() => setTheme(!isLight)} size="large">
                            </Button>
                        </Tooltip>


                        {isLight ? (<div>Hell</div>) : (<div>Dunkel</div>)}
                    </div>
                </div>
                <div className={styles.header}>
                    {t('components.settingsdrawer.feedback')}

                </div>
                <div className={styles.bodyContainer}>
                    <div className={styles.verticalContainer}>
                        <Mail24Regular className={styles.iconRightMargin} ></Mail24Regular>
                        <Link href="mailto:itm.kicc@muenchen.de?subject=MUCGPT">
                            itm.kicc@muenchen.de
                        </Link>
                    </div>
                </div>
                <div className={styles.header}>
                    {t('components.settingsdrawer.help')}

                </div>
                <div className={styles.bodyContainer}>
                    <Link href="\#faq">
                        FAQs
                    </Link>
                    <br />
                    <Link download href="https://git.muenchen.de/innovation-lab/ki-team/mucgpt-doku/-/raw/main/MucGPT%20Serviceeinf%C3%BChrung/Pilotphase/mucgpt_cheatsheet.pdf?inline=false" aria-label="Cheat Sheet">
                        Cheat Sheet
                    </Link>
                </div>
                <div className={styles.header}>
                    {t('components.settingsdrawer.snow')}
                </div>
                <div className={styles.bodyContainer}>
                    <Checkbox
                        checked={enableSnow}
                        onChange={onEnableSnowChanged}
                        label={t('components.settingsdrawer.snow_checkbox')}
                        shape="square"
                    />
                </div>
                <div className={styles.header}>
                    {t('components.settingsdrawer.about')}
                </div>
                <div className={styles.bodyContainer}>
                    <div className={styles.faq}>Version: {version}</div>
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
