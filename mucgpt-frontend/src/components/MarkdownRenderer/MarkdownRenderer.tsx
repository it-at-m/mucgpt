import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeExternalLinks from "rehype-external-links";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import TableRenderer from "../TableRenderer/TableRenderer";
import styles from "./MarkdownRenderer.module.css";

interface MarkdownRendererProps {
    children: string;
    className?: string;
}

export const MarkdownRenderer = ({ children, className }: MarkdownRendererProps) => {
    const remarkMathOptions = {
        singleDollarTextMath: false
    };
    const rehypeKatexOptions = {
        output: "mathml"
    };
    const rehypeExternalLinksOptions = {
        target: "_blank",
        rel: ["nofollow", "noopener", "noreferrer"]
    };

    const content = (
        <Markdown
            remarkPlugins={[[remarkMath, remarkMathOptions], remarkGfm]}
            rehypePlugins={[
                [rehypeKatex, rehypeKatexOptions],
                [rehypeExternalLinks, rehypeExternalLinksOptions]
            ]}
            components={{
                code: CodeBlockRenderer,
                table: TableRenderer
            }}
        >
            {children}
        </Markdown>
    );

    const wrapperClassName = className ? `${styles.markdown} ${className}` : styles.markdown;

    return <div className={wrapperClassName}>{content}</div>;
};
