import {
    Button,
    Dialog,
    DialogActions,
    DialogBody,
    DialogContent,
    DialogSurface,
    DialogTitle,
    DialogTrigger,
    Dropdown,
    Option,
    OptionOnSelectData,
    SelectionEvents,
    Tooltip,
} from "@fluentui/react-components";

import styles from "./CommunityBotsDialog.module.css";
import { useTranslation } from "react-i18next";
import { TextField } from "@fluentui/react";
import { FormEvent, useEffect, useState } from "react";
import { Bot, getCommunityBots } from "../../api";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { storeCommunityBot } from "../../service/storage_bot"
interface Props {
    showSearchDialogInput: boolean;
    setShowSearchDialogInput: (showDialogInput: boolean) => void;
}

export const CommunityBotsDialog = ({ showSearchDialogInput, setShowSearchDialogInput }: Props) => {
    const mockBot: Bot = { title: "", description: "", system_message: "", publish: false, id: "0", temperature: 0.0, max_output_tokens: 0, tags: [], version: "", owner: "owner" }
    const { t } = useTranslation();
    const [inputText, setInputText] = useState("");
    const [bots, setBot] = useState<any[]>([]);
    const [filteredBots, setFilteredBots] = useState<any[]>([]);
    const [choosenBot, setChoosenBot] = useState<Bot>(mockBot);
    const [showBotDialog, setShowBotDialog] = useState<boolean>(false);
    const [allTags, setAllTags] = useState<string[]>([]);
    const [choosenTag, setChoosenTag] = useState<string>("");

    function compareBotsByTitle(a: Bot, b: Bot) {
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
                let tags: string[] = []
                for (let bot of bots) {
                    let newTags = bot.tags.filter((tag: string) => !tags.includes(tag))
                    tags = tags.concat(newTags)
                }
                setAllTags(tags)
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

    const onPublishSelected = (e: SelectionEvents, selection: OptionOnSelectData) => {
        let tag = selection.optionValue;
        if (tag == undefined) {
            return
        }
        setChoosenTag(tag)
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
                            <br />
                            Filtern nach Tag:
                            <Dropdown
                                id="publish"
                                aria-label="Veröffentlichen"
                                defaultValue=""
                                appearance="underline"
                                size="small"
                                positioning="below-start"
                                onOptionSelect={onPublishSelected}
                            >
                                <Option text="" className={styles.option}></Option>
                                {allTags.sort().map(
                                    (tag: string, _) =>
                                        <Option text={tag.toLocaleLowerCase()} className={styles.option}>{tag}</Option>
                                )}
                            </Dropdown>
                            <br />
                            <div className={styles.container}>
                                {filteredBots.filter(bot => choosenTag == "" ? true : bot.tags.includes(choosenTag)).map(
                                    (bot: Bot, _) =>
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
