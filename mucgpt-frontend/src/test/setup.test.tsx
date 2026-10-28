// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { Button } from "@fluentui/react-components";
import { describe, expect, it } from "vitest";

describe("React test environment", () => {
    it("renders Fluent components in jsdom", () => {
        render(<Button>Test action</Button>);

        expect(screen.getByRole("button", { name: "Test action" })).toBeInTheDocument();
    });
});
