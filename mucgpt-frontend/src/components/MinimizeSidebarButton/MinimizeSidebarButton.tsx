import { ArrowMaximize24Filled, ArrowMinimize24Filled } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";

import { useTranslation } from "react-i18next";
import { STORAGE_KEYS } from "../../pages/layout/LayoutHelper";
interface Props {
    showSidebar: boolean;
    setShowSidebar: (showSidebar: boolean) => void;
}

export const MinimizeSidebarButton = ({ showSidebar, setShowSidebar }: Props) => {
    const { t } = useTranslation();
    return (
        <Tooltip content={showSidebar ? t("common.sidebar_hide") : t("common.sidebar_show")} relationship="description" positioning="below">
            <Button
                style={{ marginLeft: "5px" }}
                appearance="primary"
                icon={showSidebar ? <ArrowMinimize24Filled /> : <ArrowMaximize24Filled />}
                onClick={() => {
                    const toggled = !showSidebar;
                    setShowSidebar(toggled);
                    localStorage.setItem(STORAGE_KEYS.SHOW_SIDEBAR, toggled.toString());
                }}
            />
        </Tooltip>
    );
};
