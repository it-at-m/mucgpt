
import { ReactNode } from "react";
import styles from "./ChatTurnComponent.module.css";



interface Props {
    usermsg: ReactNode;
    botmsg: ReactNode;
    usermsglabel: string;
    botmsglabel: string;
}

export const ChatTurnComponent = ({
    usermsg,
    botmsg,
    usermsglabel,
    botmsglabel
}: Props) => {
    return (<div className={styles.chatMessageStream}>
        <li className={styles.chatMessageUser} aria-description={usermsglabel} >
            {usermsg}
        </li>
        <li className={styles.chatMessageGpt} aria-description={botmsglabel} >
            {botmsg}
        </li>
    </div>
    );
};
