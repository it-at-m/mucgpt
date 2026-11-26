import { DrawioRenderContext } from "../CodeBlockRenderer/drawioRenderContext";
import { SafeMarkdown } from "./SafeMarkdown";
import styles from "./MarkdownRenderer.module.css";

interface MarkdownRendererProps {
    children: string;
    className?: string;
    /** When true, fenced ```drawio blocks render as diagrams (assistant answers). */
    allowDrawio?: boolean;
    /** True while the assistant answer is still streaming. */
    isStreaming?: boolean;
}

export const MarkdownRenderer = ({ children, className, allowDrawio = false, isStreaming = false }: MarkdownRendererProps) => {
    const wrapperClassName = className ? `${styles.markdown} ${className}` : styles.markdown;
    return (
        <div className={wrapperClassName}>
            <DrawioRenderContext.Provider value={{ allowDrawio, isStreaming }}>
                <SafeMarkdown math code tables>
                    {children}
                </SafeMarkdown>
            </DrawioRenderContext.Provider>
        </div>
    );
};
