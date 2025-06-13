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
    Tag
} from "@fluentui/react-components";

import styles from "./CommunityBotDialog.module.css";
import { useTranslation } from "react-i18next";
import { TextField } from "@fluentui/react";
import { FormEvent, useEffect, useState } from "react";
import { Bot } from "../../api";
import { Dismiss24Regular, Save24Filled } from "@fluentui/react-icons";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import { BOT_STORE } from "../../constants";
import { BotStorageService } from "../../service/botstorage";

interface Props {
    showSearchDialogInput: boolean;
    setShowSearchDialogInput: (showDialogInput: boolean) => void;
    takeCommunityBots: boolean;
    setTakeCommunityBots: (takeCommunityBots: boolean) => void;
}

export const CommunityBotsDialog = ({ showSearchDialogInput, setShowSearchDialogInput, takeCommunityBots, setTakeCommunityBots }: Props) => {
    const mockBot: Bot = { title: "", description: "", system_message: "", publish: false, id: "0", temperature: 0.0, max_output_tokens: 0, version: "", owner: "owner", tags: [] };
    const { t } = useTranslation();
    const [inputText, setInputText] = useState("");
    const [bots, setBot] = useState<any[]>([]);
    const [filteredBots, setFilteredBots] = useState<any[]>([]);
    const [choosenBot, setChoosenBot] = useState<Bot>(mockBot);
    const [choosenBotAll, setChoosenBotAll] = useState<Bot[]>([mockBot]);
    const [showBotDialog, setShowBotDialog] = useState<boolean>(false);
    const [allTags, setAllTags] = useState<string[]>([]);
    const [choosenTag, setChoosenTag] = useState<string>("");
    const communitybotStorageService: BotStorageService = new BotStorageService(BOT_STORE);
    const [botAlreadySaved, setBotAlreadySaved] = useState<boolean>(false);


    // DUMMY
    const getCommunityBots = async (): Promise<Bot[][]> => {
        // Return some dummy bots with different versions and tags
        return [
            [
                { ...mockBot, id: "1", title: "WeatherBot", version: "1.0", tags: ["weather", "info"], description: "Get weather updates.", system_message: "Weather info", owner: "alice" },
                { ...mockBot, id: "1", title: "WeatherBot", version: "1.1", tags: ["weather", "info"], description: "Get weather updates (v1.1).", system_message: "Weather info", owner: "alice" }
            ],
            [
                { ...mockBot, id: "2", title: "NewsBot", version: "2.0", tags: ["news"], description: "Latest news headlines.", system_message: "News info", owner: "bob" }
            ],
            [
                { ...mockBot, id: "3", title: "JokeBot", version: "1.0", tags: ["fun", "jokes"], description: "Tells jokes.", system_message: "Joke info", owner: "carol" }
            ]
        ];
    };

    const getCommunityBot = async (id: string, version: string): Promise<Bot> => {
        // Return a dummy bot matching the id and version
        return { ...mockBot, id, version, title: `Bot ${id}`, description: `Description for Bot ${id} v${version}`, tags: ["dummy"], system_message: `System message for Bot ${id}` };
    };

    const getCommunityBotAllVersions = async (id: string): Promise<Bot[]> => {
        // Return some dummy versions for a bot
        if (id === "1") {
            return [
                { ...mockBot, id: "1", title: "WeatherBot", version: "1.0", tags: ["weather", "info"], description: "Get weather updates.", system_message: "Weather info", owner: "alice" },
                { ...mockBot, id: "1", title: "WeatherBot", version: "1.1", tags: ["weather", "info"], description: "Get weather updates (v1.1).", system_message: "Weather info", owner: "alice" }
            ];
        }
        if (id === "2") {
            return [
                { ...mockBot, id: "2", title: "NewsBot", version: "2.0", tags: ["news"], description: "Latest news headlines.", system_message: "News info", owner: "bob" }
            ];
        }
        if (id === "3") {
            return [
                { ...mockBot, id: "3", title: "JokeBot", version: "1.0", tags: ["fun", "jokes"], description: "Tells jokes.", system_message: "Joke info", owner: "carol" }
            ];
        }
        return [{ ...mockBot, id, version: "1.0", title: `Bot ${id}`, tags: ["dummy"], description: `Description for Bot ${id}`, system_message: `System message for Bot ${id}` }];
    };

    function findLatestVersion(bots: Bot[]): Bot {
        let latestVersion = bots[0];
        for (let bot of bots) {
            if (bot.version && latestVersion.version && bot.version > latestVersion.version) {
                latestVersion = bot;
            }
        }
        return latestVersion;
    }

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
        if (takeCommunityBots && showSearchDialogInput) {
            getCommunityBots().then((bots: Bot[][]) => {
                let latestBots: Bot[] = []
                for (let bot of bots) {
                    latestBots.push(findLatestVersion(bot))
                }
                setBot(latestBots.sort(compareBotsByTitle))
                setFilteredBots(latestBots.sort(compareBotsByTitle))
                let tags: string[] = []
                for (let bot of latestBots) {
                    if (bot.tags) {
                        let newTags = bot.tags.filter((tag: string) => !tags.includes(tag))
                        tags = tags.concat(newTags)
                    }
                }
                setAllTags(tags)
            })
            setTakeCommunityBots(false);
        }
    }, [takeCommunityBots, showSearchDialogInput]);

    let onSaveBot = () => {
        communitybotStorageService.createBotConfig(choosenBot);
        setShowBotDialog(false);
        setShowSearchDialogInput(false);
        window.location.href = "/#/community-bot/" + choosenBot.id + "/" + choosenBot.version.toString().replace(".", "-");
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

    const onTagSelected = (e: SelectionEvents, selection: OptionOnSelectData) => {
        let tag = selection.optionValue;
        if (tag == undefined) {
            return
        }
        if (tag == choosenTag) {
            setChoosenTag("")
        } else {
            setChoosenTag(tag)
        }
    };

    const onVersionSelected = (e: SelectionEvents, selection: OptionOnSelectData) => {
        let version = selection.optionValue;
        if (version == undefined || version == String(choosenBot.version) || choosenBot.id == undefined) {
            return
        }
        getCommunityBot(choosenBot.id, version).then((bot: Bot) => {
            setChoosenBot(bot);
        });
    };
    const versionPicker = (
        <Dropdown
            id="version"
            aria-label={"version"}
            defaultValue={choosenBot.version.toString()}
            value={choosenBot.version.toString()}
            selectedOptions={[choosenBot.version.toString()]}
            appearance="underline"
            size="small"
            positioning="below-start"
            onOptionSelect={onVersionSelected}
        >
            {choosenBotAll.map(
                (bot: Bot, _) => <Option value={String(bot.version)} text={"v" + bot.version.toString()} className={styles.option}>v{bot.version.toString()}</Option>
            )}
        </Dropdown>
    )


    const onChooseBot = (bot: Bot) => {
        if (bot.id == undefined) {
            return;
        }
        setChoosenBot(bot);
        setShowBotDialog(true);
        setShowSearchDialogInput(false);
        getCommunityBotAllVersions(bot.id).then((bots) => {
            setChoosenBotAll(bots);
        });
        communitybotStorageService.getBotConfig(bot.id).then((bot: Bot | undefined) => {
            setBotAlreadySaved(bot !== undefined);
        });
    }

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
                        >{t('components.community_bots.title')}</DialogTitle>
                        <DialogContent>
                            <div className="search">
                                <TextField
                                    id="outlined-basic"
                                    label={t('components.community_bots.search')}
                                    value={inputText}
                                    onChange={inputHandler}
                                />
                            </div>
                            <br />
                            {t('components.community_bots.filter_by_tag')}:
                            <Dropdown
                                id="filter"
                                aria-label={t('components.community_bots.filter_by_tag')}
                                defaultValue=""
                                value={choosenTag}
                                selectedOptions={[choosenTag]}
                                appearance="underline"
                                size="small"
                                positioning="below-start"
                                onOptionSelect={onTagSelected}
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
                                            <Button className={styles.box} onClick={() => { onChooseBot(bot) }}>
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
                        >{choosenBot.title} Version: {versionPicker}</DialogTitle>
                        <DialogContent>
                            <div className={styles.tags}>
                                {
                                    choosenBot.tags ? choosenBot.tags.map((tag: string) => <Tag shape="circular">{tag}</Tag>) : ""
                                }
                            </div>
                            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{ code: CodeBlockRenderer }}>{choosenBot.description}</Markdown>
                            <strong>{t('components.community_bots.system_message')}: </strong>
                            <hr />
                            <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{choosenBot.system_message}</Markdown>
                            <hr />
                        </DialogContent>
                        <DialogActions>
                            <DialogTrigger disableButtonEnhancement>
                                <Tooltip content={botAlreadySaved ? "Assisstent ist bereits gespeichert!" : t('components.community_bots.save')} relationship="description" positioning="above">
                                    <Button appearance="secondary" size="small" onClick={onSaveBot} disabled={botAlreadySaved}>
                                        <Save24Filled /> {t('components.community_bots.save')}
                                    </Button>
                                </Tooltip>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

        </div >
    );
};
