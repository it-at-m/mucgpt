import { ReactNode } from "react";
import { BrainstormFragment } from "../BrainstormFragment/BrainstormFragment";
import { SimplifiedTextFragment } from "../SimplifiedTextFragment/SimplifiedTextFragment";
import { FragmentRegistry } from "../FragmentRegistry";
import { DiagramFragment } from "../DiagramFragment/DiagramFragment"; // NEW

export interface FragmentManagerProps {
    content: string;
    fragmentType?: string;
}

// Initialize fragment registry immediately when module loads
FragmentRegistry.register({
    type: "brainstorming",
    title: "Brainstorming",
    identifiers: ["mucgptbrainstorming", "mucgpt-brainstorming"],
    component: BrainstormFragment as any
});

FragmentRegistry.register({
    type: "simplify",
    title: "Leichte Sprache",
    identifiers: ["einfachesprache", "leichtesprache", "mucgptsimplify", "mucgpt-simplify"],
    component: SimplifiedTextFragment as any
});

// NEW: Diagram fragment registration (detects both mermaid and graphviz blocks)
FragmentRegistry.register({
    type: "diagram",
    title: "Diagramm",
    identifiers: ["mucgptdiagram", "mucgptdiagram mermaid", "mucgptdiagram graphviz", "mucgpt-diagram"],
    component: DiagramFragment as any
});

export const FragmentManager = ({ content, fragmentType }: FragmentManagerProps): ReactNode => {
    const result = FragmentRegistry.render(content, fragmentType);

    return result;
};
