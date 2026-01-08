import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeExternalLinks from "rehype-external-links";
import CodeBlockRenderer from "../CodeBlockRenderer/CodeBlockRenderer";
import TableRenderer from "../TableRenderer/TableRenderer";

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

    if (className) {
        return <div className={className}>{content}</div>;
    }

    return content;
};
