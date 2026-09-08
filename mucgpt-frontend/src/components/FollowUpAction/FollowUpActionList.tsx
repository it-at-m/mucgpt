import { Button, Tooltip } from "@fluentui/react-components";
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
                <Tooltip key={followUpAction.id || index} content={followUpAction.prompt} relationship="description" positioning="above">
                    <Button onClick={() => onSend(followUpAction.prompt)} shape="rounded" appearance="outline" className={styles.item}>
                        <span className={styles.label}>{followUpAction.label}</span>
                    </Button>
                </Tooltip>
            ))}
        </div>
    ) : null;
};
