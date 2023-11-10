import { ChevronDown24Regular, Dismiss24Regular, Mail24Regular } from "@fluentui/react-icons";
import {
    DrawerBody,
    DrawerHeader,
    DrawerHeaderTitle,
    OverlayDrawer,
    Button,
    Divider
} from "@fluentui/react-components";

import { Comment24Regular } from "@fluentui/react-icons";
import styles from "./SettingsDrawer.module.css";
import { useCallback, useState } from "react";
import { SelectionEvents, OptionOnSelectData } from "@fluentui/react-combobox";
import { LanguageSelector } from "../../components/LanguageSelector";

interface Props {
    onLanguageSelectionChanged: (e: SelectionEvents, selection: OptionOnSelectData) => void;
    defaultlang: string;
    version: string;
}

export const SettingsDrawer = ({ onLanguageSelectionChanged, defaultlang, version }: Props) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const onClickRightButton = useCallback(() => {
        setIsOpen(true);
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
                            Einstellungen
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
                            Feedback
                        </DrawerHeaderTitle>
                    </DrawerHeader>

                    <Divider />
                </div>
                <div className={styles.bodyContainer}>
                    <div className={styles.headerNavRightMargin}>
                        <Button size="large">
                            <Comment24Regular className={styles.iconRightMargin} /> Feedback/Fehler melden
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
                            Über
                        </DrawerHeaderTitle>
                    </DrawerHeader>

                    <Divider />
                </div>
                <div className={styles.bodyContainer}>
                    <div>Version: {version}</div>
                </div>
            </OverlayDrawer >

            <div className={styles.button}>
                <Button icon={<ChevronDown24Regular />} appearance="primary" onClick={onClickRightButton}>
                    Einstellungen und Feedback
                </Button>
            </div>
        </div >
    );
};
