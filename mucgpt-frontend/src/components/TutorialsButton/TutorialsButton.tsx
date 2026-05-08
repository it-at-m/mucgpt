import { Button } from "@fluentui/react-components";
import { Book24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import styles from "./TutorialsButton.module.css";

export const TutorialsButton = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <Button
            appearance={"subtle"}
            icon={<Book24Regular className={styles.icon} />}
            aria-label={t("header.go_to_tutorials_aria", { defaultValue: "Zu Tutorials und Anleitungen navigieren" })}
            onClick={() => navigate("/tutorials")}
            className={styles.tutorialsButton}
        >
            {t("header.go_to_tutorials", { defaultValue: "Tutorials" })}
        </Button>
    );
};

export default TutorialsButton;
