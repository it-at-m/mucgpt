import { Button, Tooltip } from "@fluentui/react-components";
import { Book24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

export const TutorialsButton = () => {
    const { t } = useTranslation();

    return (
        <Tooltip content={t("menu.go_to_tutorials_tooltip", "Tutorials und Anleitungen zu Fragments und Tools")} relationship="description" positioning="below">
            <a href={"#/tutorials"}>
                <Button appearance={"subtle"} icon={<Book24Regular />} aria-label={t("menu.go_to_tutorials_aria", "Zu Tutorials und Anleitungen navigieren")}>
                    {t("menu.go_to_tutorials", "Tutorials")}
                </Button>
            </a>
        </Tooltip>
    );
};

export default TutorialsButton;
