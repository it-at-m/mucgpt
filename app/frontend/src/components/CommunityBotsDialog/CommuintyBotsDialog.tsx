import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    Link,
    Tooltip,
} from "@fluentui/react-components";

import styles from "./CommunityBotsDialog.module.css";
import { useTranslation } from "react-i18next";
import { TextField } from "@fluentui/react";
import { FormEvent, useEffect, useState } from "react";
import { Bot, getCommunityBots } from "../../api";
import { Dismiss24Regular } from "@fluentui/react-icons";
interface Props {
    showDialogInput: boolean;
    setShowDialogInput: (showDialogInput: boolean) => void;
}

export const CommunityBotsDialog = ({ showDialogInput, setShowDialogInput }: Props) => {
    const { t } = useTranslation();
    const [inputText, setInputText] = useState("");
    const [bots, setBot] = useState<any[]>([]);
    const [filteredBots, setFilteredBots] = useState<any[]>([]);

    useEffect(() => {
        if (bots.length == 0) {
            getCommunityBots().then((bots: any[]) => {
                setBot(bots)
                setFilteredBots(bots)
            })
        }
    }), [];

    let inputHandler = (event: FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string | undefined) => {
        if (newValue !== undefined && newValue !== '') {
            const lowerCase = newValue.toLowerCase();
            setInputText(lowerCase);

            const filter = bots.filter((bot) => {
                // Return the item which contains the user input
                return bot.title.toLowerCase().includes(lowerCase);
            });

            setFilteredBots(filter);
        } else {
            // Handle case when newValue is empty or undefined
            setFilteredBots(bots);
        }
    };

    return (
        <div>
            <Dialog modalType="alert" defaultOpen={false} open={showDialogInput}>
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent}>
                        <DialogActions>
                            <Tooltip content={t("components.chattsettingsdrawer.settings_button_close")} relationship="description" positioning="below">
                                <Button
                                    appearance="subtle"
                                    aria-label={t("components.chattsettingsdrawer.settings_button_close")}
                                    icon={<Dismiss24Regular />}
                                    onClick={() => setShowDialogInput(false)}
                                />
                            </Tooltip>
                        </DialogActions>
                        <DialogTitle>Assistenten der Community</DialogTitle>
                        <DialogContent>
                            <div className="search">
                                <TextField
                                    id="outlined-basic"
                                    label="Search"
                                    onChange={inputHandler}
                                />
                            </div>
                            <div className={styles.container}>
                                {filteredBots.map(
                                    (bot: Bot, _) =>
                                        <Tooltip content={bot.title} relationship="description" positioning="below">
                                            <span>{bot.title}</span>
                                        </Tooltip>
                                )}
                            </div>
                        </DialogContent>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
};
