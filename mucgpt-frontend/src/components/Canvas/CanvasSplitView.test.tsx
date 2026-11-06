// @vitest-environment jsdom
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { useEffect } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { CanvasControllerInstance } from "../../hooks/useCanvasController";
import { CanvasSplitView } from "./CanvasSplitView";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./CanvasPanel", () => ({ CanvasPanel: () => <div data-testid="canvas-panel" /> }));

const splitViewMock = vi.hoisted(() => ({
    attachContainer: vi.fn(),
    canvasWidthPx: 400,
    canvasPercent: 30,
    onDividerMouseDown: vi.fn(),
    onDividerKeyDown: vi.fn()
}));
vi.mock("../../hooks/useSplitView", () => ({ useSplitView: () => splitViewMock }));

const controller = (isOpen: boolean): CanvasControllerInstance => ({ isOpen, setIsOpen: vi.fn(), isLocked: false }) as unknown as CanvasControllerInstance;

let mounts = 0;
const Probe = () => {
    useEffect(() => {
        mounts += 1;
    }, []);
    return <p data-testid="probe" />;
};

const view = (open: boolean): ReactElement => (
    <CanvasSplitView controller={controller(open)} conversationId="conv-1">
        <Probe />
    </CanvasSplitView>
);

beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    });
});

describe("CanvasSplitView", () => {
    it("keeps the chat subtree mounted across layout toggles", () => {
        // Opening the canvas mid-stream must not remount the chat: scroll
        // position, input state, focus and rendered answers have to survive.
        mounts = 0;
        const rendered = render(view(false));
        expect(mounts).toBe(1);
        expect(document.querySelectorAll('[data-testid="probe"]')).toHaveLength(1);

        // closed → wide split: same tree position, no remount
        rendered.rerender(view(true));
        expect(mounts).toBe(1);
        expect(document.querySelector('[role="separator"]')).not.toBeNull();
        expect(document.querySelector('[data-testid="canvas-panel"]')).not.toBeNull();

        // wide split → closed: still no remount, toggle and panel gone
        rendered.rerender(view(false));
        expect(mounts).toBe(1);
        expect(document.querySelector('[role="separator"]')).toBeNull();
        expect(document.querySelector('[data-testid="canvas-panel"]')).toBeNull();
        rendered.unmount();
    });
});
