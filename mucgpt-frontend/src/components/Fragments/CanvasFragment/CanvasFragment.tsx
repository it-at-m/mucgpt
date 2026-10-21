import { useCallback } from "react";
import { Button, Tooltip } from "@fluentui/react-components";
import { Copy24Regular } from "@fluentui/react-icons";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";
import { BaseFragment } from "../BaseFragment/BaseFragment";
import { BaseFragmentProps } from "../types";
import { copyIntoCanvas } from "../../../utils/canvasStream";
import styles from "./CanvasFragment.module.css";

/**
 * Legacy SSE fallback: a ```MUCGPTCanvas fenced
 * block in the chat is rendered read-only with a "Copy into Canvas" button that
 * pushes the content into the live canvas editor via the canvasStream bridge.
 */
export const CanvasFragment = ({ content }: BaseFragmentProps) => {
    const { t } = useTranslation();

    const onCopyIntoCanvas = useCallback(() => {
        copyIntoCanvas(content);
    }, [content]);

    const copyAction = (
        <Tooltip content={t("canvas.fragment.copy_tooltip")} relationship="description" positioning="above">
            <Button appearance="subtle" icon={<Copy24Regular />} onClick={onCopyIntoCanvas} aria-label={t("canvas.fragment.copy")}>
                {t("canvas.fragment.copy")}
            </Button>
        </Tooltip>
    );

    return (
        <BaseFragment title={t("canvas.fragment.title")} content={content} actions={copyAction}>
            <div className={styles.canvasPreview}>
                <ReactMarkdown>{content}</ReactMarkdown>
            </div>
        </BaseFragment>
    );
};
