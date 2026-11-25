// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSplitView } from "./useSplitView";

interface RecordedObserver {
    callback: ResizeObserverCallback;
    element: HTMLElement | null;
    disconnect: ReturnType<typeof vi.fn>;
}

let observers: RecordedObserver[] = [];

/** Installs a ResizeObserver stub whose callbacks can be fired manually. */
function installResizeObserverStub() {
    class Stub {
        callback: ResizeObserverCallback;
        element: HTMLElement | null = null;
        disconnect = vi.fn();

        constructor(callback: ResizeObserverCallback) {
            this.callback = callback;
        }

        observe(element: HTMLElement) {
            this.element = element;
            observers.push({ callback: this.callback, element, disconnect: this.disconnect });
        }

        unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", Stub);
}

/** Fires the resize callback of every observer still attached to `container`. */
function simulateResize(container: HTMLElement) {
    act(() => {
        for (const observer of observers.filter(o => o.element === container && !o.disconnect.mock.calls.length)) {
            observer.callback([], observer as unknown as ResizeObserver);
        }
    });
}

function makeContainer(width: number) {
    const container = document.createElement("div");
    container.getBoundingClientRect = () => ({ width, right: width, top: 0, bottom: 800, height: 800, left: 0 }) as DOMRect;
    return container;
}

function setup(width = 2000) {
    const container = makeContainer(width);
    const utils = renderHook(() => useSplitView());
    act(() => {
        utils.result.current.attachContainer(container);
    });
    return { container, ...utils };
}

const keyEvent = (key: "ArrowLeft" | "ArrowRight") => ({ key, preventDefault: vi.fn() }) as unknown as React.KeyboardEvent;

describe("useSplitView", () => {
    beforeEach(() => {
        observers = [];
        installResizeObserverStub();
        document.body.className = "";
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("starts at the default canvas percentage with no measured width", () => {
        const { result } = renderHook(() => useSplitView());
        expect(result.current.canvasPercent).toBe(40);
        expect(result.current.canvasWidthPx).toBe(0);
    });

    it("measures the canvas pane width in pixels when the container resizes", () => {
        const { result, container } = setup(1000);
        simulateResize(container);
        // 40% of 1000px
        expect(result.current.canvasWidthPx).toBe(400);
    });

    it("re-clamps the stored percentage on container resize", () => {
        // container shrinks below the size the current 40% canvas would need
        const { result, container } = setup(800);
        simulateResize(container);
        // chat keeps 480px → canvas may use at most (800-480)/800 = 40%
        expect(result.current.canvasPercent).toBe(40);
    });

    it("grows the canvas with ArrowLeft and shrinks it with ArrowRight", () => {
        const { result } = setup(2000);
        const start = result.current.canvasPercent;

        act(() => {
            result.current.onDividerKeyDown(keyEvent("ArrowLeft"));
        });
        expect(result.current.canvasPercent).toBe(start + 3);

        act(() => {
            result.current.onDividerKeyDown(keyEvent("ArrowRight"));
        });
        expect(result.current.canvasPercent).toBe(start);
    });

    it("ignores other keys", () => {
        const { result } = setup();
        const start = result.current.canvasPercent;
        act(() => {
            result.current.onDividerKeyDown({ key: "Enter", preventDefault: vi.fn() } as unknown as React.KeyboardEvent);
        });
        expect(result.current.canvasPercent).toBe(start);
    });

    it("caps the canvas at the hard maximum of 80 percent", () => {
        const { result } = setup(3200);
        for (let i = 0; i < 100; i++) {
            act(() => {
                result.current.onDividerKeyDown(keyEvent("ArrowLeft"));
            });
        }
        expect(result.current.canvasPercent).toBe(80);
        // chat pane keeps at least 480px of a 3200px container
        expect(result.current.canvasWidthPx).toBe(2560);
    });

    it("respects the chat pane minimum on narrow containers", () => {
        // 600px container: chat needs 480px → canvas can use at most 120px = 20%
        const { result } = setup(600);
        act(() => {
            result.current.onDividerKeyDown(keyEvent("ArrowLeft"));
        });
        expect(result.current.canvasPercent).toBe(20);
        expect(result.current.canvasWidthPx).toBe(120);
    });

    it("lets the canvas shrink below its own floor on very narrow containers", () => {
        // 500px container: chat minimum 480px leaves only 20px (4%) for the canvas
        const { result } = setup(500);
        act(() => {
            result.current.onDividerKeyDown(keyEvent("ArrowLeft"));
        });
        expect(result.current.canvasPercent).toBe(4);
    });

    it("does not clamp (but still steps) when the container has no width yet", () => {
        const container = makeContainer(0);
        const utils = renderHook(() => useSplitView());
        act(() => {
            utils.result.current.attachContainer(container);
        });
        act(() => {
            utils.result.current.onDividerKeyDown(keyEvent("ArrowLeft"));
        });
        expect(utils.result.current.canvasPercent).toBe(43);
        expect(utils.result.current.canvasWidthPx).toBe(0);
    });

    describe("mouse dragging", () => {
        it("applies pointer positions as percentages from the right edge", () => {
            // 3000px container: canvas may grow to 80% (chat keeps its 480px minimum)
            const { result } = setup(3000);
            const mouseEvent = { preventDefault: vi.fn(), clientX: 100 } as unknown as React.MouseEvent;

            act(() => {
                result.current.onDividerMouseDown(mouseEvent);
            });
            expect(mouseEvent.preventDefault).toHaveBeenCalled();
            expect(document.body.classList.contains("resizing-preview")).toBe(true);

            act(() => {
                window.dispatchEvent(new MouseEvent("mousemove", { clientX: 100 }));
            });
            // raw = (3000 - 100) / 3000 * 100 = 96.7 → clamped to 80
            expect(result.current.canvasPercent).toBe(80);

            act(() => {
                window.dispatchEvent(new MouseEvent("mouseup"));
            });
            expect(document.body.classList.contains("resizing-preview")).toBe(false);

            // after drag end, further moves are ignored
            act(() => {
                window.dispatchEvent(new MouseEvent("mousemove", { clientX: 1500 }));
            });
            expect(result.current.canvasPercent).toBe(80);
        });

        it("cleans up the body class when unmounting mid-drag", () => {
            const { result, unmount } = setup(1000);
            act(() => {
                result.current.onDividerMouseDown({ preventDefault: vi.fn() } as unknown as React.MouseEvent);
            });
            expect(document.body.classList.contains("resizing-preview")).toBe(true);

            unmount();
            expect(document.body.classList.contains("resizing-preview")).toBe(false);
        });
    });

    it("re-attaching disconnects the previous observer and keeps measuring the new node", () => {
        const { result, container } = setup(1000);
        simulateResize(container);
        const second = makeContainer(2000);

        act(() => {
            result.current.attachContainer(second);
        });
        simulateResize(container);
        expect(result.current.canvasWidthPx).toBe(400);

        simulateResize(second);
        expect(result.current.canvasWidthPx).toBe(800); // 40% of 2000
    });

    it("detaching the container stops measuring and prevents crashes on later steps", () => {
        const { result, container } = setup(1000);
        simulateResize(container);
        act(() => {
            result.current.attachContainer(null);
        });
        simulateResize(container);
        // keyboard resize without a container must not crash nor change the measurement
        act(() => {
            result.current.onDividerKeyDown(keyEvent("ArrowLeft"));
        });
        expect(result.current.canvasPercent).toBe(43);
        expect(result.current.canvasWidthPx).toBe(400);
    });
});
