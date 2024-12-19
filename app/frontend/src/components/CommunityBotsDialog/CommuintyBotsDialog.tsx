import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    Link,
    Tooltip,
} from "@fluentui/react-components";

import styles from "./CommunityBotsDialog.module.css";
import { useTranslation } from "react-i18next";
import { TextField } from "@fluentui/react";
import { FormEvent, useEffect, useState } from "react";
import { CommunityBot, getCommunityBots } from "../../api";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { storeCommunityBot } from "../../service/storage"
interface Props {
    showSearchDialogInput: boolean;
    setShowSearchDialogInput: (showDialogInput: boolean) => void;
}

export const CommunityBotsDialog = ({ showSearchDialogInput, setShowSearchDialogInput }: Props) => {
    const mockBot: CommunityBot = { title: "", description: "", system_message: "", publish: false, id: 0, temperature: 0.0, max_output_tokens: 0 }
    const { t } = useTranslation();
    const [inputText, setInputText] = useState("");
    const [bots, setBot] = useState<any[]>([]);
    const [filteredBots, setFilteredBots] = useState<any[]>([]);
    const [choosenBot, setChoosenBot] = useState<CommunityBot>(mockBot);
    const [showBotDialog, setShowBotDialog] = useState<boolean>(false);

    function compareBotsByTitle(a: CommunityBot, b: CommunityBot) {
        const titleA = a.title.toLowerCase();
        const titleB = b.title.toLowerCase();

        if (titleA < titleB) {
            return -1;
        }
        if (titleA > titleB) {
            return 1;
        }
        return 0;
    }

    useEffect(() => {
        if (bots.length == 0) {
            getCommunityBots().then((bots: any[]) => {
                setBot(bots.sort(compareBotsByTitle))
                setFilteredBots(bots.sort(compareBotsByTitle))
            })
        }
    }), [];
    let onSaveBot = () => {
        storeCommunityBot(choosenBot)
        setShowBotDialog(false);
        setShowSearchDialogInput(true);
    }

    let inputHandler = (event: FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string | undefined) => {
        if (newValue !== undefined && newValue !== '') {
            const lowerCase = newValue.toLowerCase();
            setInputText(lowerCase);

            const filter = bots.filter((bot) => {
                // Return the item which contains the user input
                return bot.title.toLowerCase().includes(lowerCase);
            }).sort(compareBotsByTitle);

            setFilteredBots(filter);
        } else {
            // Handle case when newValue is empty or undefined
            setFilteredBots(bots);
            setInputText("");
        }
    };

    return (
        <div>
            <Dialog modalType="modal" defaultOpen={false} open={showSearchDialogInput} >
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent}>
                        <DialogTitle action={
                            <DialogTrigger action="close">
                                <Button
                                    appearance="subtle"
                                    aria-label="close"
                                    icon={<Dismiss24Regular />}
                                    onClick={() => { setInputText(""); setFilteredBots(bots); setShowSearchDialogInput(false) }}
                                />
                            </DialogTrigger>
                        }
                        >Assistenten der Community</DialogTitle>
                        <DialogContent>
                            <div className="search">
                                <TextField
                                    id="outlined-basic"
                                    label="Search"
                                    value={inputText}
                                    onChange={inputHandler}
                                />
                            </div>
                            <div className={styles.container}>
                                {filteredBots.map(
                                    (bot: CommunityBot, _) =>
                                        <Tooltip content={bot.title} relationship="description" positioning="below" >
                                            <Button className={styles.box} onClick={() => { setChoosenBot(bot); setShowBotDialog(true); setShowSearchDialogInput(false) }}>
                                                <span>{bot.title}</span>
                                            </Button>
                                        </Tooltip>
                                )}
                            </div>
                        </DialogContent>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
            <Dialog modalType="modal" defaultOpen={false} open={showBotDialog} >
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent}>
                        <DialogTitle action={
                            <DialogTrigger action="close">
                                <Button
                                    appearance="subtle"
                                    aria-label="close"
                                    icon={<Dismiss24Regular />}
                                    onClick={() => { setChoosenBot(mockBot); setShowBotDialog(false); setShowSearchDialogInput(true) }}
                                />
                            </DialogTrigger>
                        }
                        >{choosenBot.title}</DialogTitle>
                        <DialogContent>
                            {
                                Object.entries(choosenBot).map(([key, value]) => (
                                    <div key={key}>
                                        <strong>{key}:</strong> {String(value)}
                                    </div>
                                ))
                            }
                        </DialogContent>
                    </DialogBody>
                    <DialogActions>
                        <DialogTrigger disableButtonEnhancement>
                            <Button appearance="secondary" size="small" onClick={onSaveBot} style={{ "left": 0 }}>
                                Speichern
                            </Button>
                        </DialogTrigger>
                    </DialogActions>
                </DialogSurface>
            </Dialog>
        </div >
    );
};
