import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    if (mode === "ghpages") {
        return {
            plugins: [react()],
            build: {
                outDir: "dist",
                emptyOutDir: true,
                sourcemap: true,
                rollupOptions: {
                    output: {
                        manualChunks: undefined, // Disable code splitting
                        entryFileNames: "app.js",
                        chunkFileNames: "app.js",
                        assetFileNames: "assets/[name].[ext]",
                        inlineDynamicImports: true // Bundle everything into a single file
                    }
                },
                target: "esnext",
                assetsInlineLimit: 100000000, // Inline assets (like images) as base64
                cssCodeSplit: false // Combine all CSS into a single file
            },
            base: "https://it-at-m.github.io/mucgpt/" // Set the correct base path for GitHub Pages
        };
    }

    // Default configuration
    return {
        plugins: [react()],
        build: {
            outDir: "../backend/static",
            emptyOutDir: true,
            sourcemap: true,
            rollupOptions: {
                output: {
                    manualChunks: id => {
                        if (id.includes("node_modules")) {
                            return "vendor";
                        }
                    }
                }
            },
            target: "esnext"
        }
    };
});
