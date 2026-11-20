// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { CanvasControllerInstance } from "../../hooks/useCanvasController";
import { CanvasToggleButton } from "./CanvasToggleButton";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const Harness = ({ withInput = false }: { withInput?: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);
    const controller = { isOpen, setIsOpen, hasContent: true } as unknown as CanvasControllerInstance;
    return (
        <>
            {withInput && <input aria-label="chat input" />}
            <CanvasToggleButton controller={controller} />
            {isOpen && <button onClick={() => setIsOpen(false)}>close canvas</button>}
        </>
    );
};

describe("CanvasToggleButton", () => {
    it("takes focus back when closing the canvas drops focus to the document body", () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole("button", { name: "canvas.toggle" }));

        const close = screen.getByRole("button", { name: "close canvas" });
        act(() => close.focus());
        fireEvent.click(close);

        expect(document.activeElement).toBe(screen.getByRole("button", { name: "canvas.toggle" }));
    });

    it("does not steal focus from another control", () => {
        render(<Harness withInput />);
        fireEvent.click(screen.getByRole("button", { name: "canvas.toggle" }));
        fireEvent.click(screen.getByRole("button", { name: "close canvas" }));

        // Closing without focus loss, e.g. while the user is typing in the chat input.
        const input = screen.getByRole("textbox", { name: "chat input" });
        act(() => input.focus());
        fireEvent.click(screen.getByRole("button", { name: "canvas.toggle" }));
        act(() => input.focus());
        fireEvent.click(screen.getByRole("button", { name: "close canvas" }));

        expect(document.activeElement).toBe(input);
    });
});
