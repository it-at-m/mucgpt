import { Link, NavLink } from "react-router-dom";
import styles from "./Menu.module.css";
import { useTranslation } from "react-i18next";
import { AddBotButton } from "../../components/AddBotButton";
import { useContext, useEffect, useState } from "react";
import { bot_storage, getAllBots, getHighestKeyInDB, storeBot } from "../../service/storage";
import { Bot, ChatRequest } from "../../api/models";
import { Textarea, Button, TextareaOnChangeData, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, DialogTrigger, Field, Tooltip } from "@fluentui/react-components";
import { chatApi } from "../../api";
import { LLMContext } from "../../components/LLMSelector/LLMContextProvider";
import { Checkmark24Filled, Dismiss24Regular, EditArrowBack24Regular } from "@fluentui/react-icons";

const prompt_for_systemprompt = `
You are a dedicated assistant tasked with creating system prompts for other assistants. You will receive messages that include the function for the assistant for which you need to generate a system prompt. These messages will always follow this format: "Funktion: <function>".

Follow these steps to generate a fitting system prompt for an assistant based on the given <function>:

Understand the Task: Grasp the main objective, goals, requirements, constraints, and expected output.
    - Minimal Changes: If an existing prompt is provided, improve it only if it's simple. For complex prompts, enhance clarity and add missing elements without altering the original structure.
        - Reasoning Before Conclusions: Encourage reasoning steps before any conclusions are reached.ATTENTION! If the user provides examples where the reasoning happens afterward, REVERSE the order! NEVER START EXAMPLES WITH CONCLUSIONS!
            - Reasoning Order: Call out reasoning portions of the prompt and conclusion parts(specific fields by name).For each, determine the ORDER in which this is done, and whether it needs to be reversed.
    - Conclusion, classifications, or results should ALWAYS appear last.
- Examples: Include high - quality examples if helpful, using placeholders[in brackets] for complex elements.
   - What kinds of examples may need to be included, how many, and whether they are complex enough to benefit from placeholders.
- Clarity and Conciseness: Use clear, specific language.Avoid unnecessary instructions or bland statements.
- Formatting: Use markdown features for readability.DO NOT USE\`\`\` CODE BLOCKS UNLESS SPECIFICALLY REQUESTED.
- Preserve User Content: If the input task or prompt includes extensive guidelines or examples, preserve them entirely, or as closely as possible.If they are vague, consider breaking down into sub - steps.Keep any details, guidelines, examples, variables, or placeholders provided by the user.
- Constants: DO include constants in the prompt, as they are not susceptible to prompt injection.Such as guides, rubrics, and examples.
- Output Format: Explicitly the most appropriate output format, in detail.This should include length and syntax(e.g.short sentence, paragraph, JSON, etc.)
    - For tasks outputting well - defined or structured data(classification, JSON, etc.) bias toward outputting a JSON.
    - JSON should never be wrapped in code blocks(\`\`\`) unless explicitly requested.

The final prompt you output should adhere to the following structure below.Do not include any additional commentary, only output the completed system prompt.SPECIFICALLY, do not include any additional messages at the start or end of the prompt. (e.g.no "---")

[Concise instruction describing the task - this should be the first line in the prompt, no section header]

[Additional details as needed.]

[Optional sections with headings or bullet points for detailed steps.]

# Steps[optional]

[optional: a detailed breakdown of the steps necessary to accomplish the task]

# Output Format

[Specifically call out how the output should be formatted, be it response length, structure e.g.JSON, markdown, etc]

# Examples[optional]

[Optional: 1 - 3 well - defined examples with placeholders if necessary.Clearly mark where examples start and end, and what the input and output are.User placeholders as necessary.]
[If the examples are shorter than what a realistic example is expected to be, make a reference with () explaining how real examples should be longer / shorter / different.AND USE PLACEHOLDERS! ]

# Notes[optional]

[optional: edge cases, details, and an area to call or repeat out specific important considerations]`

const prompt_for_description = `
Formuliere eine prägnante Beschreibung für den Assistenten, die in genau einem Satz erklärt, welche Fähigkeiten oder Funktionen er hat. Die Beschreibung soll KEIN Besispiel sein sondern ein Satz welcher die Funktion des Assistenten klar beschreibt.

# Output Format

Die Ausgabe sollte ein einzelner Satz sein, der die Hauptfunktion des Assistenten klar und verständlich beschreibt.

# Examples

Input: "Der Assistent hilft dabei, Termine zu verwalten."  
Output: "Dieser Assistent organisiert und erinnert an Termine."

Input: "Der Assistent berechnet mathematische Formeln."  
Output: "Dieser Assistent führt komplexe mathematische Berechnungen durch."

Input: "Der Assistent gibt Reisempfehlungen."  
Output: "Dieser Assistent bietet maßgeschneiderte Reiseempfehlungen basierend auf den Vorlieben des Nutzers." 

(*Echte Beispiele sollten jeweils ähnliche, spezifische Aufgaben des Assistenten beschreiben.*)
`
const prompt_for_title = `Erstelle einen prägnanten Titel, der die Hauptfunktion des Assistenten in 1-2 Wörtern klar widerspiegelt.

- Berücksichtige die bereitgestellte Beschreibung und den Systemprompt.
- Der Titel sollte leicht verständlich und einprägsam sein.

# Output Format

Der Titel sollte in einer einzigen Zeile ohne zusätzliche Erklärungen präsentiert werden.
Besteht das Wort aus einem zusammengesetztem Nomen, füge einen für HTML unsichtbaren Bindestrich ein.

# Examples

**Input:** Beschreibung: "Dieser Assistent plant effektive Meetings." Systemprompt: "Hilfreicher Meetingplaner."  
**Output:** Meeting\-planer

**Input:** Beschreibung: "Der Assistent hilft bei der Ernährung und diätetischen Beratung." Systemprompt: "Ernährungsberater."  
**Output:** Ernährungs\-beratung

(Die Beispiele sollten den Charakter des Titels deutlich machen, realistische Beispiele sollten im relevanten Kontext länger oder spezifischer sein.)`
const Menu = () => {
    const { t, i18n } = useTranslation();
    const simply = true;
    const [bots, setBots] = useState<Bot[]>([]);
    useEffect(() => {
        getAllBots().then((bots) => {
            if (bots) {
                setBots(bots)
            } else {
                setBots([])
            }
        })
    }, [])
    const onAddBot = () => { setShowDialogInput(true) }
    const { LLM } = useContext(LLMContext);
    const createBot = async () => {
        if (input != "") {
            setLoading(true)
            let question = "Funktion: " + input
            let request: ChatRequest = {
                history: [{ user: question, bot: undefined }],
                shouldStream: false,
                temperature: 1.0,
                system_message: prompt_for_systemprompt,
                model: "gpt-4o"
            };
            let response1 = await chatApi(request)
            const sys_prompt = (await response1.json()).content
            setSystemPrompt(sys_prompt)
            question = "Systempromt: ```" + sys_prompt + "```"
            request = {
                history: [{ user: question, bot: undefined }],
                shouldStream: false,
                temperature: 1.0,
                system_message: prompt_for_description,
                model: "gpt-4o"
            };
            let response2 = await chatApi(request)
            const description = (await response2.json()).content
            setDescription(description)
            question = "Systempromt: ```" + sys_prompt + "```\nBeschreibung: ```" + description + "```"
            request = {
                history: [{ user: question, bot: undefined }],
                shouldStream: false,
                temperature: 1.0,
                system_message: prompt_for_title,
                model: "gpt-4o"
            };
            let response3 = await chatApi(request)
            const title = (await response3.json()).content
            setTitle(title)
            setLoading(false)
            setShowDialogOutput(true)
            setShowDialogInput(false)
        }
    }


    const [title, setTitle] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const [input, setInput] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    const [systemPrompt, setSystemPrompt] = useState<string>("");
    const [showDialogInput, setShowDialogInput] = useState<boolean>(false);
    const [showDialogOutput, setShowDialogOutput] = useState<boolean>(false);

    const onInputChanged = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) {
            setInput(newValue.value);
        } else {
            setInput("");
        }
    }
    const onDescriptionChanged = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) {
            setDescription(newValue.value);
        } else {
            setDescription("");
        }
    }
    const onTitleChanged = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) {
            setTitle(newValue.value);
        } else {
            setTitle("Assistent");
        }
    }
    const onRefinedPromptChanged = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: TextareaOnChangeData) => {
        if (newValue?.value) {
            setSystemPrompt(newValue.value);
        } else {
            setSystemPrompt("");
        }
    }

    const onPromptButtonClicked = async () => {
        const bot: Bot = {
            title: title,
            description: description,
            system_message: systemPrompt,
            publish: false,
            id: (await getHighestKeyInDB(bot_storage)) + 1,
            temperature: 0.6,
            max_output_tokens: LLM.max_output_tokens,
        }
        storeBot(bot);
        setShowDialogOutput(false);
        setInput("");
        setSystemPrompt("");
        setDescription("");
        setTitle("");
    }
    const onBackButtonClicked = () => {
        setShowDialogOutput(false);
        setShowDialogInput(true);
        setSystemPrompt("");
        setDescription("");
        setTitle("");
    }

    const onCancelButtonClicked = () => {
        setShowDialogInput(false);
        setInput("");
    }

    return (
        <div className={styles.container}>
            <div>
                <Dialog modalType="alert" defaultOpen={false} open={showDialogOutput}>
                    <DialogSurface className={styles.dialog}>
                        <DialogBody className={styles.dialogContent} >
                            <DialogTitle >Vorgeschlagener System Prompt, Titel und Beschreibung:</DialogTitle>
                            <DialogContent >
                                <Field
                                    size="large"
                                >
                                    {t('create_bot.title')}:
                                    <Textarea
                                        textarea={styles.systempromptTextArea}
                                        placeholder={t('create_bot.title')}
                                        value={title}
                                        size="large"
                                        onChange={onTitleChanged}
                                        maxLength={100}
                                    />
                                </Field>
                                <Field
                                    size="large"
                                >
                                    {t('create_bot.description')}:
                                    <Textarea
                                        textarea={styles.systempromptTextArea}
                                        placeholder={t('create_bot.description')}
                                        value={description}
                                        size="large"
                                        onChange={onDescriptionChanged}
                                    />
                                </Field>
                                <Field
                                    size="large"
                                >
                                    {t('create_bot.prompt')}:
                                    <Textarea
                                        textarea={styles.systempromptTextArea}
                                        placeholder={t('create_bot.prompt')}
                                        resize="vertical"
                                        value={systemPrompt}
                                        size="large"
                                        onChange={onRefinedPromptChanged}
                                    />
                                </Field>
                            </DialogContent>
                            <DialogActions>
                                <DialogTrigger disableButtonEnhancement>
                                    <Button appearance="secondary" size="small" onClick={onBackButtonClicked}>
                                        <EditArrowBack24Regular className={styles.backButton} /> Zurück</Button>
                                </DialogTrigger>
                                <DialogTrigger disableButtonEnhancement>
                                    <Button appearance="secondary" size="small" onClick={onPromptButtonClicked}>
                                        <Checkmark24Filled className={styles.saveButton} /> Speichern</Button>
                                </DialogTrigger>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            </div>
            <div>
                <Dialog modalType="alert" defaultOpen={false} open={showDialogInput}>
                    <DialogSurface className={styles.dialog}>
                        <DialogBody className={styles.dialogContent} >
                            <DialogTitle >Was soll dein Assistent können? Beschreibe die Funktion:</DialogTitle>
                            <DialogContent >
                                <Field
                                    size="large"
                                    className={styles.field}
                                >
                                    <Textarea
                                        textarea={styles.systempromptTextArea}
                                        placeholder="Beschreibe die Funktion..."
                                        size="large"
                                        rows={10}
                                        required
                                        value={input}
                                        onChange={onInputChanged}
                                        disabled={loading}
                                    />
                                    <br />
                                    <p hidden={!loading}>Generiere Prompt...</p>
                                </Field>
                            </DialogContent>
                            <DialogActions>
                                <DialogTrigger disableButtonEnhancement>
                                    <Button disabled={loading} appearance="secondary" size="small" onClick={onCancelButtonClicked}>
                                        <Dismiss24Regular className={styles.backButton} /> Abbrechen</Button>
                                </DialogTrigger>
                                <DialogTrigger disableButtonEnhancement>
                                    <Button disabled={loading} appearance="secondary" size="small" onClick={createBot}>
                                        <Checkmark24Filled className={styles.saveButton} /> {t('create_bot.create')}</Button>
                                </DialogTrigger>
                            </DialogActions>
                        </DialogBody>
                    </DialogSurface>
                </Dialog>
            </div>
            <div className={styles.row}>
                <Link to="/chat" className={styles.box}>
                    {t('header.chat')}
                </Link>
                <Link to="/sum" className={styles.box}>
                    {t('header.sum')}
                </Link>
                <Link to="/brainstorm" className={styles.box}>
                    {t('header.brainstorm')}
                </Link>
                {simply &&
                    <Link to="/simply" className={styles.box}>
                        <p className={styles.btnText}>{t('header.simply')}</p>
                    </Link>
                }
            </div>
            <div className={styles.rowheader}>
                Eigene Assistenten <AddBotButton onClick={onAddBot}></AddBotButton>
            </div>

            <div className={styles.row}>
                {bots.map((bot: Bot, _) => (
                    <Tooltip content={bot.title} relationship="description" positioning="below">
                        <Link to={`/bot/${bot.id}`} className={styles.box}>
                            {bot.title}
                        </Link>
                    </Tooltip>
                ))}
                {bots.length === 0 && <div>Keine Assistenten gefunden</div>}
            </div>
            <div className={styles.rowheader}>
                Community Assistenten
            </div>
            <div className={styles.row}>
                Comming soon...
            </div>
        </div >
    );
};

export default Menu;
