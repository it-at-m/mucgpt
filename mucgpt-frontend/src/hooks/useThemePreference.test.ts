// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "../pages/layout/LayoutHelper";
import { useThemePreference } from "./useThemePreference";

describe("useThemePreference", () => {
    beforeEach(() => {
        localStorage.clear();
        // reset the setup.ts matchMedia mock per test
        Object.defineProperty(window, "matchMedia", {
            configurable: true,
            writable: true,
            value: (query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addEventListener: () => {},
                removeEventListener: () => {},
                addListener: () => {},
                removeListener: () => {},
                dispatchEvent: () => false
            })
        });
    });

    it("defaults to light when nothing is stored", () => {
        const { result } = renderHook(() => useThemePreference());
        expect(result.current.themePreference).toBe("light");
        expect(result.current.isLight).toBe(true);
    });

    it("reads a stored theme preference", () => {
        localStorage.setItem(STORAGE_KEYS.SETTINGS_THEME, "dark");
        const { result } = renderHook(() => useThemePreference());
        expect(result.current.themePreference).toBe("dark");
        expect(result.current.isLight).toBe(false);
    });

    it("falls back to the legacy light/dark flag", () => {
        localStorage.setItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME, "false");
        const { result } = renderHook(() => useThemePreference());
        expect(result.current.themePreference).toBe("dark");
        expect(result.current.isLight).toBe(false);
    });

    it("falls back to light for unknown stored values", () => {
        localStorage.setItem(STORAGE_KEYS.SETTINGS_THEME, "neon");
        localStorage.setItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME, "true");
        const { result } = renderHook(() => useThemePreference());
        expect(result.current.themePreference).toBe("light");
    });

    it("follows the system color scheme in system mode", () => {
        Object.defineProperty(window, "matchMedia", {
            configurable: true,
            writable: true,
            value: (query: string) => ({
                matches: query === "(prefers-color-scheme: dark)",
                media: query,
                onchange: null,
                addEventListener: () => {},
                removeEventListener: () => {},
                addListener: () => {},
                removeListener: () => {},
                dispatchEvent: () => false
            })
        });
        localStorage.setItem(STORAGE_KEYS.SETTINGS_THEME, "system");
        const { result } = renderHook(() => useThemePreference());
        expect(result.current.themePreference).toBe("system");
        expect(result.current.isLight).toBe(false); // system prefers dark
    });

    it("persists a new preference and clears the legacy flag", () => {
        localStorage.setItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME, "false");
        const { result } = renderHook(() => useThemePreference());

        act(() => {
            result.current.setThemePreference("dark");
        });

        expect(result.current.themePreference).toBe("dark");
        expect(localStorage.getItem(STORAGE_KEYS.SETTINGS_THEME)).toBe("dark");
        expect(localStorage.getItem(STORAGE_KEYS.SETTINGS_IS_LIGHT_THEME)).toBeNull();
    });

    it("subscribes to system color scheme changes and unsubscribes on unmount", () => {
        const listeners = new Set<() => void>();
        Object.defineProperty(window, "matchMedia", {
            configurable: true,
            writable: true,
            value: (query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
                removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
                addListener: () => {},
                removeListener: () => {},
                dispatchEvent: () => false
            })
        });
        localStorage.setItem(STORAGE_KEYS.SETTINGS_THEME, "system");
        const { result, unmount } = renderHook(() => useThemePreference());
        expect(listeners.size).toBe(1);

        act(() => {
            for (const listener of listeners) listener();
        });
        // value unchanged (matchMedia still reports light) but no errors and listener still attached
        expect(result.current.themePreference).toBe("system");

        unmount();
        expect(listeners.size).toBe(0);
    });
});
