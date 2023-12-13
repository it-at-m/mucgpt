import { ChevronDown24Regular, Dismiss24Regular, Mail24Regular } from "@fluentui/react-icons";
import {
    DrawerHeader,
    DrawerHeaderTitle,
    OverlayDrawer,
    Button,
    Divider,
    CheckboxOnChangeData,
    CheckboxProps
} from "@fluentui/react-components";

import { Comment24Regular } from "@fluentui/react-icons";
import styles from "./SettingsDrawer.module.css";
import { ChangeEvent, useCallback, useState } from "react";
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
}

export const SettingsDrawer = ({ onLanguageSelectionChanged, defaultlang, version, enableSnow: enableSnow, onEnableSnowChanged }: Props) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const { t, i18n } = useTranslation();
    const onClickRightButton = useCallback(() => {
        setIsOpen(true);
    }, [])

    const onFeedbackClicked = useCallback(() => {
        // route to new page by changing window.location
        window.open("https://git.muenchen.de/innovation-lab/ki-team/mucgpt/-/issues/new?issuable_template=pilot-meldung", "_blank") //to open new page
    }, [])
    return (
        <div>
            <OverlayDrawer
                size="small"
                position="end"
                open={isOpen}
                style={{ 'backgroundColor': '#ffffff', 'padding': "30px", 'alignItems': 'stretch' }}
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
                    <Divider />
                </div>
                <div className={styles.bodyContainer}>
                    <LanguageSelector defaultlang={defaultlang} onSelectionChange={onLanguageSelectionChanged} ></LanguageSelector>
                </div>
                <div className={styles.header}>
                    <DrawerHeader>
                        <DrawerHeaderTitle
                        >
                            {t('components.settingsdrawer.feedback')}
                        </DrawerHeaderTitle>
                    </DrawerHeader>

                    <Divider />
                </div>
                <div className={styles.bodyContainer}>
                    <div className={styles.headerNavRightMargin}>
                        <Button size="large" onClick={onFeedbackClicked}>
                            <Comment24Regular className={styles.iconRightMargin} />  {t('components.settingsdrawer.feedback_button')}
                        </Button>
                    </div>
                    <a href="mailto:itm.kicc@muenchen.de?subject=MUCGPT" className={styles.mail}>
                        <Mail24Regular className={styles.iconRightMargin} ></Mail24Regular>
                        itm.kicc@muenchen.de
                    </a>
                </div>
                <div className={styles.header}>
                    <DrawerHeader>
                        <DrawerHeaderTitle
                        >
                            {t('components.settingsdrawer.help')}
                        </DrawerHeaderTitle>
                    </DrawerHeader>

                    <Divider />
                </div>
                <div className={styles.bodyContainer}>
                    <a href="\#faq" className={styles.faq}>FAQs</a>
                    <br />
                    <a download className={styles.faq} aria-label="Cheat Sheet" href="https://git.muenchen.de/innovation-lab/ki-team/mucgpt-doku/-/raw/main/MucGPT%20Serviceeinf%C3%BChrung/Pilotphase/mucgpt_cheatsheet.pdf?inline=false">Cheat Sheet</a>
                </div>
                <div className={styles.header}>
                    <DrawerHeader>
                        <DrawerHeaderTitle
                        >
                            {t('components.settingsdrawer.snow')}
                        </DrawerHeaderTitle>
                    </DrawerHeader>

                    <Divider />
                </div>
                <div className={styles.bodyContainer}>
                    <Checkbox
                        checked={enableSnow}
                        onChange={onEnableSnowChanged}
                        label={t('components.settingsdrawer.snow_checkbox')}
                        shape="square"
                        indicator={{ style: { borderWidth: "2px", borderStyle: "solid", borderColor: "black", marginRight: "5px", alignSelf: "center" } }}
                    />
                </div>
                <div className={styles.header}>
                    <DrawerHeader>
                        <DrawerHeaderTitle
                        >
                            {t('components.settingsdrawer.about')}
                        </DrawerHeaderTitle>
                    </DrawerHeader>

                    <Divider />
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
