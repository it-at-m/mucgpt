import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const isGHPages = mode === "ghpages";

    return {
        plugins: [react()],
        base: isGHPages ? "/mucgpt/" : "/",
        build: {
            outDir: "dist",
            sourcemap: !isGHPages,
            rollupOptions: {
                output: {
                    manualChunks: {
                        react: ["react", "react-dom", "react-router-dom"],
                        fluentui: ["@fluentui/react", "@fluentui/react-components", "@fluentui/react-icons"],
                        markdown: ["react-markdown", "remark-gfm"],
                        visualizations: ["markmap-view", "markmap-lib", "mermaid"]
                    }
                }
            }
        },
        resolve: {
            alias: {
                "@": resolve(__dirname, "src")
            }
        },
        preview: {
            port: 4173
        },
        // Add environment variable handling
        define: {
            "process.env.NODE_ENV": JSON.stringify(mode),
            "process.env.BUILD_TIME": JSON.stringify(new Date().toISOString())
        }
    };
});
