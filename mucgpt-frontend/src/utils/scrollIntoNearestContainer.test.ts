// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { findScrollContainer, scrollIntoNearestContainer } from "./scrollIntoNearestContainer";

function elementInScrollable(overflowY: string, scrollTop = 100): { element: HTMLElement; container: HTMLElement } {
    const container = document.createElement("div");
    container.style.overflowY = overflowY;
    container.scrollTop = scrollTop;
    const element = document.createElement("p");
    container.appendChild(element);
    document.body.appendChild(container);
    return { element, container };
}

describe("findScrollContainer", () => {
    it.each(["auto", "scroll", "overlay"])("finds a %s ancestor", overflowY => {
        const { element, container } = elementInScrollable(overflowY);
        expect(findScrollContainer(element)).toBe(container);
    });

    it("skips non-scrollable ancestors and finds the nearest scrollable one", () => {
        const outer = document.createElement("div");
        outer.style.overflowY = "scroll";
        const middle = document.createElement("div");
        middle.style.overflowY = "hidden";
        const element = document.createElement("span");
        middle.appendChild(element);
        outer.appendChild(middle);
        document.body.appendChild(outer);

        expect(findScrollContainer(element)).toBe(outer);
    });

    it("returns null without a scrollable ancestor", () => {
        const wrapper = document.createElement("div");
        const element = document.createElement("p");
        wrapper.appendChild(element);
        document.body.appendChild(wrapper);

        expect(findScrollContainer(element)).toBeNull();
        expect(findScrollContainer(element.parentElement!)).toBeNull();
    });
});

describe("scrollIntoNearestContainer", () => {
    it("does nothing without an element", () => {
        expect(() => scrollIntoNearestContainer(null)).not.toThrow();
        expect(() => scrollIntoNearestContainer(undefined)).not.toThrow();
    });

    it("does nothing when no scrollable ancestor exists", () => {
        const wrapper = document.createElement("div");
        const element = document.createElement("p");
        wrapper.appendChild(element);
        document.body.appendChild(wrapper);
        const scrollToSpy = vi.fn();
        (wrapper as HTMLElement & { scrollTo: unknown }).scrollTo = scrollToSpy;

        scrollIntoNearestContainer(element);
        expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("scrolls the nearest container to align the element's bottom edge", () => {
        const { element, container } = elementInScrollable("auto");
        container.getBoundingClientRect = () => ({ top: 0, bottom: 500, height: 500 }) as DOMRect;
        element.getBoundingClientRect = () => ({ top: 700, bottom: 760 }) as DOMRect;
        const scrollToSpy = vi.fn();
        (container as HTMLElement & { scrollTo: unknown }).scrollTo = scrollToSpy;

        scrollIntoNearestContainer(element);

        // offset = elementBottom - containerBottom + scrollMarginBottom(0)
        expect(scrollToSpy).toHaveBeenCalledExactlyOnceWith({ top: 100 + (760 - 500), behavior: "smooth" });
    });

    it("scrolls to align the element's top edge when block='start'", () => {
        const { element, container } = elementInScrollable("auto");
        container.getBoundingClientRect = () => ({ top: 0, bottom: 500, height: 500 }) as DOMRect;
        element.getBoundingClientRect = () => ({ top: 700, bottom: 760 }) as DOMRect;
        element.style.scrollMarginTop = "12px";
        const scrollToSpy = vi.fn();
        (container as HTMLElement & { scrollTo: unknown }).scrollTo = scrollToSpy;

        scrollIntoNearestContainer(element, { block: "start", behavior: "instant" });

        // offset = elementTop - containerTop - scrollMarginTop
        expect(scrollToSpy).toHaveBeenCalledExactlyOnceWith({ top: 100 + (700 - 12), behavior: "instant" });
    });

    it("treats invalid scroll margins as zero", () => {
        const { element, container } = elementInScrollable("auto");
        container.getBoundingClientRect = () => ({ top: 0, bottom: 500, height: 500 }) as DOMRect;
        element.getBoundingClientRect = () => ({ top: 700, bottom: 760 }) as DOMRect;
        const scrollToSpy = vi.fn();
        (container as HTMLElement & { scrollTo: unknown }).scrollTo = scrollToSpy;

        scrollIntoNearestContainer(element);
        expect(scrollToSpy).toHaveBeenCalledExactlyOnceWith({ top: 100 + 260, behavior: "smooth" });
    });
});
