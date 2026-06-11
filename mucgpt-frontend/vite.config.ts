import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
    const isGHPages = mode === "ghpages";
    const isPWAEnabled = process.env.VITE_DISABLE_PWA !== "true";
    const shouldSelfDestroyPWA = !isPWAEnabled && mode !== "development";

    return {
        plugins: [
            react(),
            ...(isPWAEnabled
                ? [
                      VitePWA({
                          registerType: "prompt",
                          strategies: "generateSW",
                          manifest: {
                              name: "MUCGPT",
                              short_name: "MUCGPT",
                              description: "KI-Assistent der Landeshauptstadt München",
                              theme_color: "#2563eb",
                              background_color: "#f8fafc",
                              display: "standalone",
                              start_url: isGHPages ? "/mucgpt/" : "/",
                              scope: isGHPages ? "/mucgpt/" : "/",
                              icons: [
                                  { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
                                  { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
                                  { src: "pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
                                  { src: "maskable-icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
                              ]
                          },
                          workbox: {
                              maximumFileSizeToCacheInBytes: 3000000,
                              navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/sso\//, /^\/realms\//, /^\/oauth2\//, /^\/login\//, /^\/logout\//],
                              runtimeCaching: [
                                  {
                                      urlPattern: /^\/api\/.*$/,
                                      handler: "NetworkOnly"
                                  },
                                  {
                                      urlPattern: /^\/(auth|sso|realms|oauth2|login|logout)\/.*$/,
                                      handler: "NetworkOnly"
                                  }
                              ]
                          }
                      })
                  ]
                : shouldSelfDestroyPWA
                  ? [
                        VitePWA({
                            selfDestroying: true
                        })
                    ]
                  : [])
        ],
        base: isGHPages ? "/mucgpt/" : "/",
        worker: {
            format: "es"
        },
        build: {
            outDir: "dist",
            sourcemap: !isGHPages,
            rollupOptions: {
                output: {
                    manualChunks: {
                        react: ["react", "react-dom", "react-router-dom"],
                        fluentui: ["@fluentui/react", "@fluentui/react-components", "@fluentui/react-icons"],
                        markdown: ["react-markdown", "remark-gfm"],
                        visualizations: ["markmap-view", "markmap-lib", "mermaid"],
                        transformers: ["@huggingface/transformers"]
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
        },
        server: {
            host: true,
            proxy: {
                "/api": "http://localhost:8083"
            },
            allowedHosts: ["host.docker.internal"], // required to use frontend behind proxy (e.g. API Gateway)
            headers: {
                "x-frame-options": "SAMEORIGIN", // required to use devtools behind proxy (e.g. API Gateway)
                "Cross-Origin-Opener-Policy": "same-origin", // required for SharedArrayBuffer (ONNX runtime)
                "Cross-Origin-Embedder-Policy": "credentialless" // allows anonymous cross-origin fetches (e.g. HuggingFace model downloads)
            }
        }
    };
});
