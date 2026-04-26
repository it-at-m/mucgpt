import { Button, Tooltip } from "@fluentui/react-components";
import { Mic24Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TranscriptionSettingsDialog } from "./TranscriptionSettingsDialog";
import styles from "./TranscriptionSettingsButton.module.css";

export const TranscriptionSettingsButton = () => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const label = t("components.transcriptionSettings.open_tooltip");

    return (
        <>
            <Tooltip content={label} relationship="description" positioning="below">
                <Button
                    appearance="subtle"
                    icon={<Mic24Regular className={styles.icon} />}
                    aria-label={label}
                    onClick={() => setOpen(true)}
                    className={styles.button}
                />
            </Tooltip>
            <TranscriptionSettingsDialog open={open} onOpenChange={setOpen} />
        </>
    );
};

export default TranscriptionSettingsButton;
