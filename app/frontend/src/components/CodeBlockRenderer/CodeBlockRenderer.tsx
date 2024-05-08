// @ts-nocheck
import { IconButton } from "@fluentui/react";
import { ClassAttributes, HTMLAttributes, useState, useEffect } from "react";
import { ExtraProps } from "react-markdown";
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { dark, duotoneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import styles from "./CodeBlockRenderer.module.css";
import { Mermaid, MermaidProps } from "./Mermaid";
import { STORAGE_KEYS } from "../../pages/layout/LayoutHelper";



export default function CodeBlockRenderer(props: ClassAttributes<HTMLElement> & HTMLAttributes<HTMLElement> & ExtraProps) {
  const { children, className, node, ...rest } = props
  const match = /language-(\w+)/.exec(className || '')
  const [copied, setCopied] = useState<boolean>(false);
  const [icon, setIcon] = useState<string>("Copy")
  const ligth_theme_pref = localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) === null ? true : localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME) == 'true';



  const oncopy = () => {
    setCopied(true);
    setIcon("Checkmark");
    setTimeout(() => {
      setIcon("Copy");
      setCopied(false);
    }, 1000)
  }

  const language = match ? match[1] : "";

  if (language === "mermaid") {

    const mermaidProps: MermaidProps = {
      text: String(children),
      darkTheme: !ligth_theme_pref
    };

    return <Mermaid {...mermaidProps} />
  }
  else {

    const isMultiline = String(children).includes("\n")
    return (
      isMultiline ? (
        <div className={styles.codeContainer}>
          <SyntaxHighlighter
            {...rest}
            children={String(children).replace(/\n$/, '')}
            style={ligth_theme_pref ? duotoneLight : dark}
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
}