// @vitest-environment jsdom
import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useFileDropZone } from "./useFileDropZone";

const DropZone = ({ enabled, onFiles }: { enabled: boolean; onFiles: (files: File[]) => void }) => {
    const { isDragActive, dropZoneProps } = useFileDropZone(onFiles, enabled);
    return (
        <div data-testid="zone" data-active={isDragActive} {...dropZoneProps}>
            zone
        </div>
    );
};

const fileTransfer = () => ({ types: ["Files"], files: [new File(["text"], "Notiz.txt", { type: "text/plain" })], dropEffect: "none" });

const drop = (zone: HTMLElement) => {
    const event = createEvent.drop(zone, { dataTransfer: fileTransfer() });
    fireEvent(zone, event);
    return event;
};

describe("useFileDropZone", () => {
    it("hands dropped files to the callback when enabled", () => {
        const onFiles = vi.fn();
        render(<DropZone enabled onFiles={onFiles} />);
        const zone = screen.getByTestId("zone");

        fireEvent.dragEnter(zone, { dataTransfer: fileTransfer() });
        expect(zone).toHaveAttribute("data-active", "true");

        expect(drop(zone).defaultPrevented).toBe(true);
        expect(onFiles).toHaveBeenCalledWith([expect.objectContaining({ name: "Notiz.txt" })]);
        expect(zone).toHaveAttribute("data-active", "false");
    });

    it("still blocks the browser from opening a dropped file while disabled", () => {
        const onFiles = vi.fn();
        render(<DropZone enabled={false} onFiles={onFiles} />);
        const zone = screen.getByTestId("zone");

        fireEvent.dragEnter(zone, { dataTransfer: fileTransfer() });
        expect(zone).toHaveAttribute("data-active", "false");

        expect(drop(zone).defaultPrevented).toBe(true);
        expect(onFiles).not.toHaveBeenCalled();
    });

    it("ignores drags without files", () => {
        render(<DropZone enabled onFiles={vi.fn()} />);
        const zone = screen.getByTestId("zone");

        const event = createEvent.drop(zone, { dataTransfer: { types: ["text/plain"], files: [] } });
        fireEvent(zone, event);
        expect(event.defaultPrevented).toBe(false);
    });
});
