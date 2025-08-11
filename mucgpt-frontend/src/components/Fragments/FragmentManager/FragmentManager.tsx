import { ReactNode, useEffect } from "react";
import { BrainstormFragment } from "../BrainstormFragment/BrainstormFragment";
import { SimplifiedTextFragment } from "../SimplifiedTextFragment/SimplifiedTextFragment";
import { FragmentRegistry } from "../FragmentRegistry";

export interface FragmentManagerProps {
    content: string;
    fragmentType?: string;
}

// Initialize fragment registry with default fragments
const initializeRegistry = () => {
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
};

export const FragmentManager = ({ content, fragmentType }: FragmentManagerProps): ReactNode => {
    useEffect(() => {
        initializeRegistry();
    }, []);

    console.log("FragmentManager called:", { fragmentType, contentPreview: content.substring(0, 50) + "..." });

    const result = FragmentRegistry.render(content, fragmentType);
    console.log("FragmentRegistry result:", result ? "Component returned" : "No component returned");

    return result;
};
