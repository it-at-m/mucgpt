import React, { useEffect, useState } from "react";
import styles from "./Mermaid.module.css";
import { ArrowDownload24Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
import mermaid, { MermaidConfig } from "mermaid";
export interface MermaidProps {
    text: string;
    darkTheme: boolean;
}

export const Mermaid: React.FC<MermaidProps> = ({ text, darkTheme }) => {
    const [diagram, setDiagram] = useState<string | boolean>(true);
    const [id, setID] = useState<string>("");
    const { t } = useTranslation();

    useEffect(() => {
        const render = async () => {
            // Generate a random ID for Mermaid to use.
            const id = `mermaid-svg-${Math.round(Math.random() * 10000000)}`;
            setID(id);

            mermaid.initialize({
                startOnLoad: false,
                theme: darkTheme ? "dark" : "default",
                securityLevel: "loose",
                suppressErrorRendering: true
            } as MermaidConfig);
            // Confirm the diagram is valid before rendering since it could be invalid
            // while streaming, or if the LLM "hallucinates" an invalid diagram.
            text = text.replaceAll("`", "");
            let validMermaid = await mermaid.parse(text, { suppressErrors: true });
            if (validMermaid) {
                const { svg } = await mermaid.render(id, text).then(
                    value => value,
                    _ => {
                        return { svg: undefined };
                    }
                );
                if (svg) {
                    const svgImage = new DOMParser().parseFromString(svg, "text/html").body.firstElementChild;
                    if (svgImage) {
                        svgImage.setAttribute("width", "700px");
                        svgImage.setAttribute("max-width", "100%"); //TODO Besser auf die größe des Übergeordneten Containers skalieren
                        svgImage.setAttribute("height", "100%");
                    }
                    if (svgImage) setDiagram(svgImage.outerHTML);
                    else setDiagram(false);
                } else {
                    document.querySelectorAll(`[id=${id}`).forEach(el => el.remove());
                    setDiagram(false);
                }
            } else {
                setDiagram(false);
            }
            //remove error elements
        };
        render();
    }, [text]);

    const download = () => {
        const svgElement = document.getElementById(id);

        if (svgElement) {
            const base64doc = btoa(unescape(encodeURIComponent(svgElement.outerHTML)));
            const a = document.createElement("a");
            const e = new MouseEvent("click");

            a.download = "diagram.svg";
            a.href = "data:text/html;base64," + base64doc;
            a.dispatchEvent(e);
        }
    };

    if (diagram === true) {
        return <p className="...">{t("components.mermaid.render")}</p>;
    } else if (diagram === false) {
        return <p className="...">{t("components.mermaid.error")}</p>;
    } else {
        return (
            <div className={styles.diagramContainer}>
                <div dangerouslySetInnerHTML={{ __html: diagram ?? "" }}></div>
                <div className={styles.downloadContainer}>
                    mermaid
                    <Tooltip content={t("components.mermaid.download")} relationship="description" positioning="above">
                        <Button
                            appearance="subtle"
                            aria-label={t("components.mermaid.download")}
                            icon={<ArrowDownload24Regular className={styles.iconRightMargin} />}
                            onClick={() => download()}
                            size="large"
                        ></Button>
                    </Tooltip>
                </div>
            </div>
        );
    }
};
