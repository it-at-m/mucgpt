import { Tooltip } from "@fluentui/react-components";
import { PanelRight24Regular } from "@fluentui/react-icons";
import { useEffect, useRef } from "react";
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
    const buttonRef = useRef<HTMLButtonElement>(null);
    const isVisible = !controller.isOpen && controller.hasContent;

    // Closing the canvas unmounts the focused control inside it while this button
    // was not mounted, so no focus-restore target survives; reclaim the lost focus.
    useEffect(() => {
        if (isVisible && document.activeElement === document.body) buttonRef.current?.focus();
    }, [isVisible]);

    if (!isVisible) return null;

    return (
        <Tooltip content={t("canvas.toggle")} relationship="label" positioning="below">
            <Button ref={buttonRef} appearance="subtle" icon={<PanelRight24Regular />} onClick={() => controller.setIsOpen(true)} />
        </Tooltip>
    );
};
