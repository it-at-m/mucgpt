// @ts-nocheck
import { IconButton } from "@fluentui/react";
import { ClassAttributes, HTMLAttributes, useState } from "react";
import { ExtraProps } from "react-markdown";
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { dark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import styles from "./CodeBlockRenderer.module.css";

export default function CodeBlockRenderer(props: ClassAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & ExtraProps) {
  const { children, className, node, ...rest } = props
  const match = /language-(\w+)/.exec(className || '')
  const [copied, setCopied] = useState<boolean>(false);
  const [icon, setIcon] = useState<string>("Copy")

  const oncopy = () => {
    setCopied(true);
    setIcon("Checkmark");
    setTimeout(() => {
      setIcon("Copy");
      setCopied(false);
    }, 1000)
  }

  const language = match ? match[1] : "";
  const isMultiline = String(children).includes("\n")
  return (
    isMultiline ? (
      <div className={styles.codeContainer}>
        <SyntaxHighlighter
          {...rest}
          children={String(children).replace(/\n$/, '')}
          style={dark}
          language={language}
          PreTag="div"
          showLineNumbers={true}
          wrapLongLines={true}
        />
        <div className={styles.copyContainer}>
          {language}
          <CopyToClipboard text={children}
            onCopy={oncopy}>
            <IconButton
              style={{ color: "black" }}
              iconProps={{ iconName: icon }}
            >
            </IconButton>
          </CopyToClipboard>
        </div>
      </div>
    ) :
      <code {...rest} className={className}>{children}</code>
  )
}