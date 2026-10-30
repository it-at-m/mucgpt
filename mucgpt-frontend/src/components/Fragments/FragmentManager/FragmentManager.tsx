import { ReactNode } from "react";
import { BrainstormFragment } from "../BrainstormFragment/BrainstormFragment";
import { CanvasFragment } from "../CanvasFragment/CanvasFragment";
import { SimplifiedTextFragment } from "../SimplifiedTextFragment/SimplifiedTextFragment";
import { FragmentRegistry } from "../FragmentRegistry";

export interface FragmentManagerProps {
    content: string;
    fragmentType?: string;
}

// Initialize fragment registry immediately when module loads
FragmentRegistry.register({
    type: "brainstorming",
    title: "Brainstorming",
    identifiers: ["mucgptbrainstorming", "mucgpt-brainstorming"],
    component: BrainstormFragment
});

FragmentRegistry.register({
    type: "simplify",
    title: "Leichte Sprache",
    identifiers: ["einfachesprache", "leichtesprache", "mucgptsimplify", "mucgpt-simplify"],
    component: SimplifiedTextFragment
});

FragmentRegistry.register({
    type: "canvas",
    title: "Canvas",
    identifiers: ["mucgptcanvas", "mucgpt-canvas"],
    component: CanvasFragment
});

export const FragmentManager = ({ content, fragmentType }: FragmentManagerProps): ReactNode => {
    const result = FragmentRegistry.render(content, fragmentType);

    return result;
};
