import { BotAdd24Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";

import styles from "./SearchBotButton.module.css";
import { useTranslation } from "react-i18next";
interface Props {
    onClick: () => void;
}

export const SearchBotButton = ({ onClick }: Props) => {
    const { t } = useTranslation();
    return (
        <div className={styles.container}>
            <Tooltip content="Bots Suchen" relationship="description" positioning="below">
                <Button
                    appearance="secondary"
                    aria-label="Bots Suchen"
                    icon={<BotAdd24Regular className={styles.iconLeftMargin} />}
                    onClick={onClick}
                    size="large"
                >
                    Bots Suchen
                </Button>
            </Tooltip>
        </div>
    );
};
