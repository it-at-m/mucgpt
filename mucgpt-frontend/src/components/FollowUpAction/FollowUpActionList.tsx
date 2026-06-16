import { Stack } from "@fluentui/react";
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
        <Stack>
            <div className={styles.buttons}>
                {followUpActions.map(followUpAction => (
                    <Tooltip content={followUpAction.tooltip} relationship="description" positioning="above" key={followUpAction.id}>
                        <Button onClick={() => onSend(followUpAction.prompt)} appearance="secondary" className={styles.item}>
                            {followUpAction.label}
                        </Button>
                    </Tooltip>
                ))}
            </div>
        </Stack>
    ) : (
        <></>
    );
};
