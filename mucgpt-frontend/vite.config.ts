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
                              // Raised from 3 MB: Rolldown (Vite 8) bundles the mermaid/markmap
                              // "visualizations" chunk slightly larger (~3.5 MB) than Rollup did.
                              maximumFileSizeToCacheInBytes: 4000000,
                              globIgnores: ["**/*.wasm"],
                              navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/sso\//, /^\/realms\//, /^\/oauth2\//, /^\/login\//, /^\/logout\//],
                              runtimeCaching: [
                                  {
                                      urlPattern: /\/assets\/.*\.wasm$/,
                                      handler: "CacheFirst",
                                      options: {
                                          cacheName: "wasm-assets",
                                          expiration: {
                                              maxEntries: 10
                                          }
                                      }
                                  },
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
            rolldownOptions: {
                output: {
                    // Vite 8 / Rolldown replaces the removed object-form `manualChunks`
                    // with `codeSplitting.groups`, matching modules by path via `test`.
                    // Higher `priority` groups match first, so the more specific
                    // react-* packages are claimed before the broad `react` group.
                    codeSplitting: {
                        groups: [
                            { name: "fluentui", test: /node_modules[\\/]@fluentui[\\/]/, priority: 30 },
                            { name: "visualizations", test: /node_modules[\\/](markmap-view|markmap-lib|mermaid)[\\/]/, priority: 30 },
                            { name: "transformers", test: /node_modules[\\/]@huggingface[\\/]transformers[\\/]/, priority: 30 },
                            { name: "markdown", test: /node_modules[\\/](react-markdown|remark-gfm)[\\/]/, priority: 20 },
                            { name: "react", test: /node_modules[\\/](react|react-dom|react-router-dom)[\\/]/, priority: 10 }
                        ]
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
            port: 4173,
            headers: {
                "x-frame-options": "SAMEORIGIN", // required to use devtools behind proxy (e.g. API Gateway)
                "Cross-Origin-Opener-Policy": "same-origin", // required for SharedArrayBuffer (ONNX runtime)
                "Cross-Origin-Embedder-Policy": "credentialless" // allows anonymous cross-origin fetches (e.g. HuggingFace model downloads)
            }
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
