import { describe, expect, it } from "vitest";
import { CREATIVITY_LOW, CREATIVITY_MEDIUM } from "../constants";
import { AssistantImportError, hasValidAssistantImportFilename, parseAssistantImport } from "./assistant-import";

const validExport = {
    title: "Meeting notes assistant",
    description: "Turns notes into a summary",
    system_message: "Summarize the supplied notes.",
    creativity: CREATIVITY_MEDIUM,
    default_model: "model-a",
    tools: [{ id: "summarize", config: { mode: "brief" } }],
    quick_prompts: [{ label: "Summarize", prompt: "Summarize these notes" }],
    examples: [{ text: "Create summary", value: "Please summarize this." }],
    tags: ["meetings"],
    hierarchical_access: ["IT"],
    is_visible: true
};

const errorCode = (callback: () => unknown) => {
    try {
        callback();
    } catch (error) {
        expect(error).toBeInstanceOf(AssistantImportError);
        return (error as AssistantImportError).code;
    }
    throw new Error("Expected assistant import validation to fail");
};

describe("hasValidAssistantImportFilename", () => {
    it("accepts a filename with exactly one JSON extension", () => {
        expect(hasValidAssistantImportFilename("assistant.json")).toBe(true);
        expect(hasValidAssistantImportFilename("assistant.JSON")).toBe(true);
    });

    it.each(["assistant", ".json", "assistant.txt", "assistant.exe.json", "assistant.tar.json", "assistant.json.txt"])("rejects %s", filename => {
        expect(hasValidAssistantImportFilename(filename)).toBe(false);
    });
});

describe("parseAssistantImport", () => {
    it("returns a validated import draft for a complete assistant export", () => {
        expect(parseAssistantImport("meeting-notes.json", JSON.stringify(validExport))).toEqual({
            title: "Meeting notes assistant",
            description: "Turns notes into a summary",
            systemMessage: "Summarize the supplied notes.",
            creativity: CREATIVITY_MEDIUM,
            defaultModel: "model-a",
            tools: [{ id: "summarize", config: { mode: "brief" } }],
            followUpActions: [{ label: "Summarize", prompt: "Summarize these notes" }],
            starterPrompts: [{ text: "Create summary", value: "Please summarize this." }],
            hierarchicalAccess: ["IT"],
            isVisible: true
        });
    });

    it("supports older minimal exports while assigning safe defaults", () => {
        expect(parseAssistantImport("assistant.json", JSON.stringify({ title: "Assistant", system_message: "Help the user." }))).toEqual({
            title: "Assistant",
            description: "",
            systemMessage: "Help the user.",
            creativity: CREATIVITY_LOW,
            defaultModel: undefined,
            tools: [],
            followUpActions: [],
            starterPrompts: [],
            hierarchicalAccess: [],
            isVisible: false
        });
    });

    it("rejects a filename with a double extension before parsing its content", () => {
        expect(errorCode(() => parseAssistantImport("assistant.exe.json", JSON.stringify(validExport)))).toBe("unsupported_filename");
    });

    it("rejects malformed JSON", () => {
        expect(errorCode(() => parseAssistantImport("assistant.json", "{invalid"))).toBe("malformed_json");
    });

    it.each(["null", "[]", '"assistant"'])("rejects a non-object JSON root: %s", content => {
        expect(errorCode(() => parseAssistantImport("assistant.json", content))).toBe("invalid_structure");
    });

    it.each([
        ["a blank title", { ...validExport, title: "   " }],
        ["a blank system message", { ...validExport, system_message: "" }],
        ["a non-string description", { ...validExport, description: false }],
        ["an unknown creativity level", { ...validExport, creativity: "creative" }],
        ["a non-string default model", { ...validExport, default_model: 1 }],
        ["non-boolean visibility", { ...validExport, is_visible: "true" }],
        ["an empty tool id", { ...validExport, tools: [{ id: "" }] }],
        ["an invalid tool configuration", { ...validExport, tools: [{ id: "tool", config: [] }] }],
        ["an invalid follow-up action", { ...validExport, quick_prompts: [{ label: "Label" }] }],
        ["an invalid starter prompt", { ...validExport, examples: [{ text: "Example", value: 1 }] }],
        ["an invalid access list", { ...validExport, hierarchical_access: ["IT", 1] }],
        ["invalid tags", { ...validExport, tags: ["meetings", 1] }]
    ])("rejects an import with %s", (_description, data) => {
        expect(errorCode(() => parseAssistantImport("assistant.json", JSON.stringify(data)))).toBe("invalid_structure");
    });
});
