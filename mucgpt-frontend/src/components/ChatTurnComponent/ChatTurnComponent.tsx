import { ReactNode } from "react";
import styles from "./ChatTurnComponent.module.css";

interface Props {
    usermsg: ReactNode;
    assistantmsg: ReactNode;
    usermsglabel: string;
    assistantmsglabel: string;
    innerRef?: React.Ref<HTMLDivElement>;
}

export const ChatTurnComponent = ({ usermsg, assistantmsg, usermsglabel, assistantmsglabel, innerRef }: Props) => {
    return (
        <div className={styles.chatMessageStream} ref={innerRef}>
            <li className={styles.chatMessageUser} aria-description={usermsglabel}>
                {usermsg}
            </li>
            <li className={styles.chatMessageGpt} aria-description={assistantmsglabel}>
                {assistantmsg}
            </li>
        </div>
    );
};
