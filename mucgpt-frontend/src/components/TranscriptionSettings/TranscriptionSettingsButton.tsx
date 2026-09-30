import { Mic24Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TranscriptionSettingsDialog } from "./TranscriptionSettingsDialog";
import { MenuItem } from "../../ui/MenuItem";

export const TranscriptionSettingsButton = () => {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    return (
        <>
            <MenuItem icon={<Mic24Regular />} onClick={() => setOpen(true)}>
                {t("components.transcriptionSettings.title")}
            </MenuItem>
            <TranscriptionSettingsDialog open={open} onOpenChange={setOpen} />
        </>
    );
};

export default TranscriptionSettingsButton;
