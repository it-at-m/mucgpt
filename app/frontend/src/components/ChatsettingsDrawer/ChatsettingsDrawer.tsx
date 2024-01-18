import { ChatSettings24Regular, Dismiss24Regular } from "@fluentui/react-icons";
import {
    DrawerHeader,
    DrawerHeaderTitle,
    OverlayDrawer,
    Button,
    Slider,
    Label,
    useId,
    SliderProps,
    Field,
    InfoLabel,
    Tooltip
} from "@fluentui/react-components";

import styles from "./ChatsettingsDrawer.module.css";
import { Dispatch, SetStateAction, useCallback, useState } from "react";
import { useTranslation } from 'react-i18next';
import { TextField } from "@fluentui/react";
interface Props {
    temperature: number;
    setTemperature: Dispatch<SetStateAction<number>>;
    max_tokens: number;
    setMaxTokens: Dispatch<SetStateAction<number>>;
    systemPrompt: string;
    setSystemPrompt: Dispatch<SetStateAction<string>>;
}

export const ChatsettingsDrawer = ({ temperature, setTemperature, max_tokens, setMaxTokens, systemPrompt, setSystemPrompt }: Props) => {
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const { t, i18n } = useTranslation();
    const onClickRightButton = useCallback(() => {
        setIsOpen(true);
    }, [])

    const temperatureID = useId("input-temperature");
    const max_tokensID = useId("input-max_tokens");

    const min_max_tokens = 10;
    const max_max_tokens = 4000;
    const min_temp = 0;
    const max_temp = 1;

    const onTemperatureChange: SliderProps["onChange"] = (_, data) =>
        setTemperature(data.value);
    const onMaxtokensChange: SliderProps["onChange"] = (_, data) =>
        setMaxTokens(data.value);

    const onSytemPromptChange = (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, data: string | undefined) => {
        if (data)
            setSystemPrompt(data);
        else
            setSystemPrompt("");
    }

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
                            {t('components.chattsettingsdrawer.settings_button')}

                        </DrawerHeaderTitle>

                    </DrawerHeader>
                </div>


                <div className={styles.header}>
                    <InfoLabel
                        info={
                            <div className={styles.info}>
                                <i>{t('components.chattsettingsdrawer.system_prompt')}s </i>{t('components.chattsettingsdrawer.system_prompt_info')}
                            </div>
                        }
                    >
                        {t('components.chattsettingsdrawer.system_prompt')}
                    </InfoLabel>

                </div>

                <div className={styles.bodyContainer}>
                    <div >
                        <Field
                            placeholder={t('components.chattsettingsdrawer.system_prompt')}
                            size="large"
                        >
                            <TextField
                                className={styles.questionInputTextArea}
                                placeholder={t('components.chattsettingsdrawer.system_prompt')}
                                multiline
                                resizable={false}
                                value={systemPrompt}
                                onChange={onSytemPromptChange}
                                autoAdjustHeight={true}
                            />
                        </Field>
                    </div>
                </div>

                <div className={styles.header}>
                    <InfoLabel
                        info={
                            <div className={styles.info}>
                                {t('components.chattsettingsdrawer.max_lenght_info')}
                            </div>
                        }
                    >
                        {t('components.chattsettingsdrawer.max_lenght')}
                    </InfoLabel>

                </div>

                <div className={styles.bodyContainer}>

                    <div className={styles.verticalContainer}>
                        <Slider min={min_max_tokens}
                            max={max_max_tokens}
                            defaultValue={20}
                            onChange={onMaxtokensChange}
                            aria-valuetext={`Value is ${max_tokensID}`}
                            value={max_tokens}
                            id={max_tokensID} />
                        <br></br>
                        <Label htmlFor={max_tokensID}>
                            {max_tokens} Tokens
                        </Label>
                    </div>
                </div>
                <div className={styles.header}>
                    <InfoLabel
                        info={
                            <div className={styles.info}>
                                {t('components.chattsettingsdrawer.temperature_article')} <i>{t('components.chattsettingsdrawer.temperature')}</i> {t('components.chattsettingsdrawer.temperature_info')}
                            </div>
                        }
                    >
                        {t('components.chattsettingsdrawer.temperature')}
                    </InfoLabel>
                </div>
                <div className={styles.bodyContainer}>

                    <div className={styles.verticalContainer}>
                        <Slider min={min_temp}
                            max={max_temp}
                            defaultValue={2}
                            onChange={onTemperatureChange}
                            aria-valuetext={`Value is ${temperature}`}
                            value={temperature}
                            rail={{ style: { backgroundColor: "black" } }}
                            thumb={{ style: { backgroundColor: "black" } }}
                            step={0.05}
                            id={temperatureID} />
                        <br></br>
                        <Label htmlFor={temperatureID}>
                            {temperature}
                        </Label>
                    </div>
                </div>
            </OverlayDrawer >

            <div className={styles.button}>
                <Tooltip content={t('components.chattsettingsdrawer.settings_button')} relationship="description" positioning="below">
                    <Button icon={<ChatSettings24Regular />} appearance="secondary" onClick={onClickRightButton} size="large">
                    </Button>
                </Tooltip>
            </div>
        </div >
    );
};
