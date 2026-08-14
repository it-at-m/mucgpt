import { Button } from "@fluentui/react-components";
import { ArrowEnterLeft20Regular } from "@fluentui/react-icons";
import styles from "./FollowUpActionList.module.css";
import { FollowUpActionContext } from "./FollowUpActionProvider";
import { useContext } from "react";

interface Props {
    onSend: (prompt: string) => void;
}

export const FollowUpActionList = ({ onSend }: Props) => {
    const { followUpActions } = useContext(FollowUpActionContext);
    return followUpActions.length > 0 ? (
        <div className={styles.buttons}>
            {followUpActions.map((followUpAction, index) => (
                <Button
                    key={followUpAction.id || index}
                    onClick={() => onSend(followUpAction.prompt)}
                    shape="circular"
                    appearance="secondary"
                    className={styles.item}
                >
                    <ArrowEnterLeft20Regular className={styles.icon} aria-hidden="true" />
                    <span className={styles.label}>{followUpAction.label}</span>
                </Button>
            ))}
        </div>
    ) : (
        <></>
    );
};
