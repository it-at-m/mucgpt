import { Checkmark24Filled, Dismiss24Regular, EditArrowBack24Regular } from "@fluentui/react-icons";
import { Button, Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, Field, Textarea, TextareaOnChangeData } from "@fluentui/react-components";

import styles from "./CreateBotDialog.module.css";
import { useTranslation } from 'react-i18next';
import { useContext, useState } from "react";
import { LLMContext } from "../LLMSelector/LLMContextProvider";
import { bot_storage, getHighestKeyInDB, storeBot } from "../../service/storage";
import { Bot, ChatRequest, chatApi, createBotApi } from "../../api";

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
`
const prompt_for_title = ``

const example1 = "Englischübersetzer: Der Assistent übersetzt den eingegebenen Text ins Englische."
const example2 = "Der Assistent ist ein Mitarbeiter der Stadt München und antwortet höflich sowie individuell auf die eingehenden E-Mails."
const example3 = "Der Assistent erstellt für das eingegebene Wort oder den eingegebenen Satz zehn verschiedene Umformulierungen oder Synonyme."

interface Props {
    showDialogInput: boolean;
    setShowDialogInput: (showDialogInput: boolean) => void;
}

export const CreateBotDialog = ({ showDialogInput, setShowDialogInput }: Props) => {
    const [loading, setLoading] = useState<boolean>(false);
    const [input, setInput] = useState<string>("");
    const [description, setDescription] = useState<string>("");
    const [systemPrompt, setSystemPrompt] = useState<string>("");
    const { LLM } = useContext(LLMContext);
    const [title, setTitle] = useState<string>("");
    const [showDialogOutput, setShowDialogOutput] = useState<boolean>(false);

    const { t } = useTranslation();
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
        const id = (await getHighestKeyInDB(bot_storage)) + 1;
        const bot: Bot = {
            title: title,
            description: description,
            system_message: systemPrompt,
            publish: false,
            id: id,
            temperature: 0.6,
            max_output_tokens: LLM.max_output_tokens,
        }
        storeBot(bot);
        window.location.href = "/#/bot/" + id
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

    const createBot = async () => {
        if (input != "") {
            setLoading(true)
            const result = await (await createBotApi({ input: input, model: "gpt-4o", max_output_tokens: LLM.max_output_tokens })).json()


            setSystemPrompt(result.system_prompt)
            setDescription(result.description)
            setTitle(result.title)
            setLoading(false)
            setShowDialogOutput(true)
            setShowDialogInput(false)
        }
    }

    return (
        <div>
            <Dialog modalType="alert" defaultOpen={false} open={showDialogInput}>
                <DialogSurface className={styles.dialog}>
                    <DialogBody className={styles.dialogContent} >
                        <DialogTitle >Was soll dein Assistent können?</DialogTitle>
                        <DialogContent >
                            <div className={styles.exampleList}>
                                <Button disabled={loading} className={styles.exampleBox} onClick={() => setInput(example1)}>Beispiel 1: Übersetzer</Button>
                                <Button disabled={loading} className={styles.exampleBox} onClick={() => setInput(example2)}>Beispiel 2: Email</Button>
                                <Button disabled={loading} className={styles.exampleBox} onClick={() => setInput(example3)}>Beispiel 3: Synonyme</Button>
                            </div>
                            <Field
                                size="large"
                            >
                                <Textarea
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
                                    <Dismiss24Regular /> Abbrechen</Button>
                            </DialogTrigger>
                            <DialogTrigger disableButtonEnhancement>
                                <Button disabled={loading} appearance="secondary" size="small" onClick={createBot}>
                                    <Checkmark24Filled /> {t('create_bot.create')}</Button>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
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
                                    <EditArrowBack24Regular /> Zurück</Button>
                            </DialogTrigger>
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary" size="small" onClick={onPromptButtonClicked}>
                                    <Checkmark24Filled /> Speichern</Button>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
};
