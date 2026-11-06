import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
    cleanup();
});

class ResizeObserverMock {
    observe() {}

    unobserve() {}

    disconnect() {}
}

if (typeof window !== "undefined") {
    Object.defineProperty(window, "ResizeObserver", {
        configurable: true,
        writable: true,
        value: ResizeObserverMock
    });

    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: (query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false
        })
    });
}
