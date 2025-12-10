import { Button, Tooltip } from "@fluentui/react-components";
import { Book24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

export const TutorialsButton = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <Tooltip content={t("menu.go_to_tutorials_tooltip", "Tutorials und Anleitungen zu Fragments und Tools")} relationship="description" positioning="below">
            <Button
                appearance={"subtle"}
                icon={<Book24Regular style={{ color: "var(--surface)" }} />}
                aria-label={t("menu.go_to_tutorials_aria", "Zu Tutorials und Anleitungen navigieren")}
                onClick={() => navigate("/tutorials")}
                style={{ color: "var(--surface)" }}
            >
                {t("menu.go_to_tutorials", "Tutorials")}
            </Button>
        </Tooltip>
    );
};

export default TutorialsButton;
