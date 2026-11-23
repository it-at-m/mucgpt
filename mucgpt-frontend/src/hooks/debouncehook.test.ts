// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useDebounce from "./debouncehook";

describe("useDebounce", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("returns the initial value immediately and the new value after the delay", async () => {
        vi.useFakeTimers();
        const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
            initialProps: { value: "first", delay: 500 }
        });
        expect(result.current).toBe("first");

        rerender({ value: "second", delay: 500 });
        expect(result.current).toBe("first");

        act(() => {
            vi.advanceTimersByTime(500);
        });
        expect(result.current).toBe("second");
    });

    it("uses the default delay of 500ms when none is given", () => {
        vi.useFakeTimers();
        const { result, rerender } = renderHook((value: string) => useDebounce(value), { initialProps: "a" });

        rerender("b");
        act(() => {
            vi.advanceTimersByTime(499);
        });
        expect(result.current).toBe("a");
        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(result.current).toBe("b");
    });

    it("cancels a pending update when the value changes again before the delay", () => {
        vi.useFakeTimers();
        const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
            initialProps: { value: "a", delay: 300 }
        });

        rerender({ value: "b", delay: 300 });
        act(() => {
            vi.advanceTimersByTime(200);
        });
        rerender({ value: "c", delay: 300 });
        act(() => {
            vi.advanceTimersByTime(200);
        });
        // "b" was cancelled; "c" still pending
        expect(result.current).toBe("a");
        act(() => {
            vi.advanceTimersByTime(100);
        });
        expect(result.current).toBe("c");
    });
});
