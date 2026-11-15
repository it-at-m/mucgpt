import { Tooltip } from "@fluentui/react-components";
import { PanelRight24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import type { CanvasControllerInstance } from "../../hooks/useCanvasController";
import { Button } from "../../ui/Button";

interface Props {
    controller: CanvasControllerInstance;
}

/**
 * Header action that reopens a closed canvas. Hidden while the canvas is empty:
 * the agent opens the canvas itself on its first write, so there is nothing to
 * reopen before that.
 */
export const CanvasToggleButton = ({ controller }: Props) => {
    const { t } = useTranslation();
    if (controller.isOpen || !controller.hasContent) return null;

    return (
        <Tooltip content={t("canvas.toggle")} relationship="label" positioning="below">
            <Button appearance="subtle" icon={<PanelRight24Regular />} onClick={() => controller.setIsOpen(true)} />
        </Tooltip>
    );
};
