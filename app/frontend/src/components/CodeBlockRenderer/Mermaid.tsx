import React, { useEffect, useState } from "react";
import mermaid from "mermaid";
import styles from "./Mermaid.module.css";
import { ArrowDownload24Regular } from "@fluentui/react-icons";
import { Button, Tooltip } from "@fluentui/react-components";
import { useTranslation } from "react-i18next";
export interface MermaidProps {
    text: string;
}


mermaid.initialize({
    startOnLoad: true,
    theme: "default",
    securityLevel: "loose",
    themeCSS: `
      g.classGroup rect {
        fill: #282a36;
        stroke: #6272a4;
      } 
      g.classGroup text {
        fill: #f8f8f2;
      }
      g.classGroup line {
        stroke: #f8f8f2;
        stroke-width: 0.5;
      }
      .classLabel .box {
        stroke: #21222c;
        stroke-width: 3;
        fill: #21222c;
        opacity: 1;
      }
      .classLabel .label {
        fill: #f1fa8c;
      }
      .relation {
        stroke: #ff79c6;
        stroke-width: 1;
      }
      #compositionStart, #compositionEnd {
        fill: #bd93f9;
        stroke: #bd93f9;
        stroke-width: 1;
      }
      #aggregationEnd, #aggregationStart {
        fill: #21222c;
        stroke: #50fa7b;
        stroke-width: 1;
      }
      #dependencyStart, #dependencyEnd {
        fill: #00bcd4;
        stroke: #00bcd4;
        stroke-width: 1;
      } 
      #extensionStart, #extensionEnd {
        fill: #f8f8f2;
        stroke: #f8f8f2;
        stroke-width: 1;
      }`,
    fontFamily: "Fira Code"
});

export const Mermaid: React.FC<MermaidProps> = ({ text }) => {
    const [diagram, setDiagram] = useState<string | boolean>(true);
    const [id, setID] = useState<string>("");
    const { t } = useTranslation();

    useEffect(() => {
        const render = async () => {
            // Generate a random ID for Mermaid to use.
            const id = `mermaid-svg-${Math.round(Math.random() * 10000000)}`;
            setID(id);

            // Confirm the diagram is valid before rendering since it could be invalid
            // while streaming, or if the LLM "hallucinates" an invalid diagram.
            if (await mermaid.parse(text, { suppressErrors: true })) {
                const { svg } = await mermaid.render(id, text);
                const svgImage = new DOMParser().parseFromString(svg, "text/html").body
                    .firstElementChild;
                if (svgImage) {
                    svgImage.setAttribute("width", "700px");
                    svgImage.setAttribute("max-width", "100%"); //TODO Besser auf die größe des Übergeordneten Containers skalieren
                    svgImage.setAttribute("height", "100%");
                }
                if (svgImage)
                    setDiagram(svgImage.outerHTML);
                else
                    setDiagram(false);
            } else {
                setDiagram(false);
            }
        };
        render();


    }, [text]);

    const download = () => {
        const svgElement = document.getElementById(id);

        if (svgElement) {
            const base64doc = btoa(unescape(encodeURIComponent(svgElement.outerHTML)));
            const a = document.createElement('a');
            const e = new MouseEvent('click');

            a.download = 'diagram.svg';
            a.href = 'data:text/html;base64,' + base64doc;
            a.dispatchEvent(e)
        }
    }

    if (diagram === true) {
        return <p className="...">Rendering diagram...</p>;
    } else if (diagram === false) {
        return <p className="...">Unable to render this diagram.</p>;
    } else {
        return <div className={styles.diagramContainer}>
            <div dangerouslySetInnerHTML={{ __html: diagram ?? "" }}></div>
            <div className={styles.downloadContainer}>
                mermaid
                <Tooltip content={t('components.mermaid.download')} relationship="description" positioning="above">
                    <Button appearance="subtle" aria-label={t('components.mermaid.download')} icon={<ArrowDownload24Regular className={styles.iconRightMargin} />}
                        onClick={() => download()} size="large">
                    </Button>
                </Tooltip>
            </div>
        </div>;
    }
};
