import { Stack } from "@fluentui/react";
import { Button, Divider, Tooltip } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import styles from "./FollowUpActionList.module.css";
import { FollowUpActionContext } from "./FollowUpActionProvider";
import { useContext } from "react";

interface Props {
    onSend: (prompt: string) => void;
}

export const FollowUpActionList = ({ onSend }: Props) => {
    const { t } = useTranslation();
    const { followUpActions } = useContext(FollowUpActionContext);
    return followUpActions.length > 0 ? (
        <Stack>
            <Divider className={styles.divider}>
                <b>{t("components.follow_up_action.name")}</b>
            </Divider>
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
