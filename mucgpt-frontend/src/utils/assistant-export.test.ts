// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { Assistant } from "../api/models";
import { downloadAssistantExport, mapAssistantToExportData, mapVersionToExportData, sanitizeAssistantFilename } from "./assistant-export";

describe("sanitizeAssistantFilename", () => {
    it("keeps clean names as they are", () => {
        expect(sanitizeAssistantFilename("Excel Bericht 2026")).toBe("Excel Bericht 2026");
    });

    it("replaces filesystem-hostile characters", () => {
        expect(sanitizeAssistantFilename('a/b\\c:d*e?f"g<h>i|j.k')).toBe("a_b_c_d_e_f_g_h_i_j_k");
    });

    it("replaces dots so exported files can be imported again", () => {
        expect(sanitizeAssistantFilename("My Assistant Version 1.2")).toBe("My Assistant Version 1_2");
    });

    it("trims surrounding whitespace", () => {
        expect(sanitizeAssistantFilename("  Titel  ")).toBe("Titel");
    });

    it("falls back to 'assistant' when nothing usable remains", () => {
        expect(sanitizeAssistantFilename("///")).toBe("assistant");
        expect(sanitizeAssistantFilename("___")).toBe("assistant");
        expect(sanitizeAssistantFilename("   ")).toBe("assistant");
        expect(sanitizeAssistantFilename("???")).toBe("assistant");
    });
});

const baseAssistant = {
    id: "a-1",
    title: "Mein Assistent",
    creativity: "medium",
    is_visible: true,
    description: "Beschreibung",
    system_message: "Systemtext",
    examples: [{ text: "Beispiel", value: "Wert" }],
    quick_prompts: [],
    tools: ["tool-a"],
    tags: ["hr"],
    hierarchical_access: ["IT"]
} as unknown as Assistant;

describe("export mapping", () => {
    it("maps an owned assistant with all optional fields", () => {
        expect(mapAssistantToExportData(baseAssistant)).toEqual({
            title: "Mein Assistent",
            description: "Beschreibung",
            system_message: "Systemtext",
            creativity: "medium",
            default_model: undefined,
            examples: [{ text: "Beispiel", value: "Wert" }],
            quick_prompts: [],
            tools: ["tool-a"],
            tags: ["hr"],
            hierarchical_access: ["IT"],
            is_visible: true
        });
    });

    it("fills defaults for missing optional fields", () => {
        const sparse = { id: "a-2", title: "Schlicht", creativity: "low", is_visible: false } as unknown as Assistant;
        expect(mapAssistantToExportData(sparse)).toEqual(
            expect.objectContaining({
                description: "",
                system_message: "",
                examples: [],
                quick_prompts: [],
                tools: [],
                tags: [],
                hierarchical_access: [],
                is_visible: false
            })
        );
    });

    it("maps a version response onto the same export shape", () => {
        const version = {
            name: "Version 3",
            system_prompt: "Prompt",
            creativity: "high",
            is_visible: true,
            version: "3"
        } as never;
        const data = mapVersionToExportData(version);
        expect(data).toEqual(
            expect.objectContaining({
                title: "Version 3",
                system_message: "Prompt",
                creativity: "high",
                is_visible: true
            })
        );
    });
});

describe("downloadAssistantExport", () => {
    it("downloads a pretty-printed JSON file with a sanitized name", () => {
        const createObjectURL = vi.fn(() => "blob:download");
        const revokeObjectURL = vi.fn();
        URL.createObjectURL = createObjectURL as typeof URL.createObjectURL;
        URL.revokeObjectURL = revokeObjectURL as typeof URL.revokeObjectURL;
        const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

        downloadAssistantExport(mapAssistantToExportData(baseAssistant), "Import/Export: Test?");

        expect(createObjectURL).toHaveBeenCalledOnce();
        expect(clickSpy).toHaveBeenCalledOnce();
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:download");
        // the temporary anchor is removed again
        expect(document.querySelectorAll("a[download]")).toHaveLength(0);
    });
});
