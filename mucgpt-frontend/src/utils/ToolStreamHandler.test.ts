import { beforeEach, describe, expect, it } from "vitest";
import { ToolStreamHandler } from "./ToolStreamHandler";

describe("ToolStreamHandler", () => {
    let handler: ToolStreamHandler;

    beforeEach(() => {
        handler = new ToolStreamHandler();
    });

    it("starts a tool and reports a status change", () => {
        const { updatedBuffer, statusChange } = handler.handleToolCall({ name: "Web Search", state: "STARTED", content: "searching…" });

        expect(statusChange).toBe(true);
        expect(updatedBuffer).toMatchObject({
            name: "Web Search",
            content: "",
            isActive: true,
            status: { message: "searching…", state: "STARTED" }
        });
        expect(handler.hasActiveTools()).toBe(true);
    });

    it("buffers tool content across UPDATE and APPEND states without status change", () => {
        handler.handleToolCall({ name: "search", state: "STARTED", content: "" });
        const first = handler.handleToolCall({ name: "search", state: "UPDATE", content: "part 1" });
        expect(first.statusChange).toBe(false);
        expect(first.updatedBuffer.content).toBe("part 1");

        const second = handler.handleToolCall({ name: "search", state: "APPEND", content: " + part 2" });
        expect(second.statusChange).toBe(false);
        expect(second.updatedBuffer.content).toBe("part 1 + part 2");
        expect(handler.hasActiveTools()).toBe(true);
    });

    it("ends a tool and deactivates it", () => {
        handler.handleToolCall({ name: "search", state: "STARTED", content: "working" });
        handler.handleToolCall({ name: "search", state: "UPDATE", content: "worked output" });
        const { updatedBuffer, statusChange } = handler.handleToolCall({ name: "search", state: "ENDED", content: "done" });

        expect(statusChange).toBe(true);
        expect(updatedBuffer).toMatchObject({ isActive: false, status: { message: "done", state: "ENDED" } });
        expect(handler.hasActiveTools()).toBe(false);
        // content written before the end survives
        expect(handler.getFormattedContent()).toContain("worked output");
    });

    it("is case-insensitive on the tool name", () => {
        handler.handleToolCall({ name: "Search", state: "STARTED", content: "go" });
        const { updatedBuffer } = handler.handleToolCall({ name: "SEARCH", state: "UPDATE", content: "go-go" });
        expect(updatedBuffer.content).toBe("go-go");
        expect(handler.getActiveToolStatuses()).toHaveLength(1);
    });

    it("rolls back a tool: clears its buffer and reports cancellation", () => {
        handler.handleToolCall({ name: "search", state: "STARTED", content: "draft" });
        handler.handleToolCall({ name: "search", state: "UPDATE", content: "long draft" });

        const { updatedBuffer, statusChange } = handler.handleToolCall({ name: "search", state: "ROLLBACK", content: "" });

        expect(statusChange).toBe(true);
        expect(updatedBuffer).toMatchObject({
            name: "search",
            content: "",
            isActive: false,
            status: { message: "Operation canceled", state: "ENDED" }
        });
        expect(handler.hasActiveTools()).toBe(false);
        expect(handler.getFormattedContent()).toBe("");
    });

    it("formats buffered content as MUCGPT code fences", () => {
        handler.handleToolCall({ name: "alpha", state: "STARTED", content: "" });
        handler.handleToolCall({ name: "alpha", state: "UPDATE", content: "alpha output" });
        handler.handleToolCall({ name: "beta", state: "STARTED", content: "" });
        handler.handleToolCall({ name: "beta", state: "ENDED", content: "" });
        // no content → not rendered
        handler.handleToolCall({ name: "gamma", state: "STARTED", content: "  \n " });

        expect(handler.getFormattedContent()).toBe("\n```MUCGPTalpha\nalpha output\n```\n");
    });

    it("lists statuses of touched tools and hides untouched ones", () => {
        handler.handleToolCall({ name: "alpha", state: "STARTED", content: "running alpha" });
        handler.handleToolCall({ name: "beta", state: "UPDATE", content: "silently buffering" });

        expect(handler.getActiveToolStatuses()).toEqual([{ name: "alpha", message: "running alpha", state: "STARTED", timestamp: expect.any(Number) }]);
    });

    it("clearAll forgets every tool", () => {
        handler.handleToolCall({ name: "alpha", state: "STARTED", content: "x" });
        handler.clearAll();

        expect(handler.getActiveToolStatuses()).toEqual([]);
        expect(handler.getFormattedContent()).toBe("");
        expect(handler.hasActiveTools()).toBe(false);
        // a fresh buffer is created for the next call
        const { updatedBuffer } = handler.handleToolCall({ name: "alpha", state: "UPDATE", content: "new" });
        expect(updatedBuffer.content).toBe("new");
    });
});
