import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/*.test.{ts,tsx}"],
        setupFiles: ["./src/test/setup.ts"],
        coverage: {
            provider: "v8",
            enabled: true,
            reporter: ["text", "html"],
            include: ["src/**/*.{ts,tsx}"],
            exclude: ["src/test/**", "src/**/*.test.{ts,tsx}", "src/workers/nemo/spike/**"],
            // Floor to prevent regression; ratchet upwards as coverage grows.
            thresholds: {
                statements: 19,
                branches: 15,
                functions: 15,
                lines: 19
            }
        }
    }
});
