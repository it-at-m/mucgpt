import { useContext } from "react";
import { useTranslation } from "react-i18next";
import styles from "./Unauthorized.module.css";
import { UserContext } from "./layout/UserContextProvider";
import { Spinner } from "@fluentui/react-components";

interface UnauthorizedProps {
    redirectUrl?: string;
}

const Unauthorized = ({ redirectUrl }: UnauthorizedProps) => {
    const { t } = useTranslation();
    const { user, isLoading } = useContext(UserContext);

    const userName = user?.givenname || user?.displayName || user?.username || "";

    if (isLoading) {
        return (
            <div className={styles.container}>
                <Spinner size="large" />
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>{t("common.errors.unauthorized_title", "Zugriff verweigert")}</h1>
            <p className={styles.message}>
                {t("common.errors.unauthorized_message", "Sie haben keine Berechtigung, auf diese Anwendung zuzugreifen.", { name: userName })}
            </p>
            {redirectUrl && (
                <a href={redirectUrl} target="_blank" rel="noopener noreferrer" className={styles.link}>
                    {t("common.errors.unauthorized_link_text", "Zugriff beantragen")}
                </a>
            )}
        </div>
    );
};

export default Unauthorized;
