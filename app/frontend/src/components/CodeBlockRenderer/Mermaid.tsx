import React, { useEffect, useState } from "react";
import mermaid from "mermaid";
import styles from "./Mermaid.module.css";

export interface MermaidProps {
    text: string;
}

export const Mermaid: React.FC<MermaidProps> = ({ text }) => {
    const [diagram, setDiagram] = useState<string | boolean>(true);

    useEffect(() => {
        const render = async () => {
            // Generate a random ID for Mermaid to use.
            const id = `mermaid-svg-${Math.round(Math.random() * 10000000)}`;

            // Confirm the diagram is valid before rendering since it could be invalid
            // while streaming, or if the LLM "hallucinates" an invalid diagram.
            if (await mermaid.parse(text, { suppressErrors: true })) {
                const { svg } = await mermaid.render(id, text);
                const svgImage = new DOMParser().parseFromString(svg, "text/html").body
                    .firstElementChild;
                if (svgImage) {
                    debugger;
                    svgImage.setAttribute("width", "700px"); //TODO Besser auf die größe des Übergeordneten Containers skalieren
                    svgImage.setAttribute("height", "100%"); // TODO Download button vom SVG/PNG
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

    if (diagram === true) {
        return <p className="...">Rendering diagram...</p>;
    } else if (diagram === false) {
        return <p className="...">Unable to render this diagram.</p>;
    } else {
        return <div dangerouslySetInnerHTML={{ __html: diagram ?? "" }} />;
    }
};
