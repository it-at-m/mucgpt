import { ReactNode } from "react";
import styles from "./ChatTurnComponent.module.css";

interface Props {
    usermsg: ReactNode;
    assistantmsg: ReactNode;
    usermsglabel: string;
    assistantmsglabel: string;
}

export const ChatTurnComponent = ({ usermsg, assistantmsg, usermsglabel, assistantmsglabel }: Props) => {
    return (
        <div className={styles.chatMessageStream}>
            <li className={styles.chatMessageUser} aria-description={usermsglabel}>
                {usermsg}
            </li>
            <li className={styles.chatMessageGpt} aria-description={assistantmsglabel}>
                {assistantmsg}
            </li>
        </div>
    );
};
