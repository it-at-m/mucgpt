import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Button, OverlayDrawer } from "@fluentui/react-components";
import { PanelRight24Regular } from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";

import type { CanvasControllerInstance } from "../../hooks/useCanvasController";
import { useSplitView } from "../../hooks/useSplitView";
import { CanvasPanel } from "./CanvasPanel";
import styles from "./CanvasSplitView.module.css";

const NARROW_MEDIA_QUERY = "(max-width: 899px)";

interface Props {
    controller: CanvasControllerInstance;
    conversationId: string | undefined;
    /** Backend conversation id for server requests; defaults to conversationId. */
    serverConversationId?: string;
    children: ReactNode;
    onInsertIntoChat?: (markdown: string) => void;
    onAgentRevise?: (markdown: string) => void;
}

const useIsNarrowLayout = () => {
    const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(NARROW_MEDIA_QUERY).matches);
    useEffect(() => {
        const media = window.matchMedia(NARROW_MEDIA_QUERY);
        const onChange = (event: MediaQueryListEvent) => setIsNarrow(event.matches);
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, []);
    return isNarrow;
};

export const CanvasSplitView = ({ controller, conversationId, serverConversationId, children, onInsertIntoChat, onAgentRevise }: Props) => {
    const { t } = useTranslation();
    const isNarrow = useIsNarrowLayout();
    const split = useSplitView();

    const panel = (
        <CanvasPanel
            controller={controller}
            conversationId={conversationId}
            serverConversationId={serverConversationId}
            onInsertIntoChat={onInsertIntoChat}
            onAgentRevise={onAgentRevise}
        />
    );

    // ChatLayout's fixed bars (header, input, scroll-to-bottom) offset their right
    // edge by the pane width while the split is active; the drawer takes no offset.
    const containerStyle = { "--canvasPaneWidth": controller.isOpen && !isNarrow ? `${split.canvasWidthPx}px` : "0px" } as CSSProperties;

    if (!controller.isOpen) {
        return (
            <div className={styles.full} ref={split.attachContainer} style={containerStyle}>
                {children}
                <Button appearance="secondary" className={styles.floatingToggle} icon={<PanelRight24Regular />} onClick={() => controller.setIsOpen(true)}>
                    {t("canvas.toggle")}
                </Button>
            </div>
        );
    }

    if (isNarrow) {
        return (
            <div className={styles.full} ref={split.attachContainer} style={containerStyle}>
                {children}
                {/* <900px: the canvas opens as a Fluent OverlayDrawer (modal by Fluent design). */}
                <OverlayDrawer position="end" size="medium" open onOpenChange={(_, data) => !data.open && controller.setIsOpen(false)}>
                    {panel}
                </OverlayDrawer>
            </div>
        );
    }

    return (
        <div className={styles.split} ref={split.attachContainer} style={containerStyle}>
            <div className={styles.chatPane}>{children}</div>
            <div
                role="separator"
                aria-orientation="vertical"
                aria-label={t("canvas.split_divider")}
                aria-valuenow={Math.round(split.canvasPercent)}
                aria-valuemin={0}
                aria-valuemax={100}
                tabIndex={0}
                className={styles.divider}
                onMouseDown={split.onDividerMouseDown}
                onKeyDown={split.onDividerKeyDown}
            >
                <span className={styles.dividerHandle} />
            </div>
            <div className={styles.canvasPane} style={{ width: `${split.canvasPercent}%` }}>
                {panel}
            </div>
        </div>
    );
};
