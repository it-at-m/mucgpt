import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { initializeIcons } from "@fluentui/react";
import "./i18n";

import "./index.css";

import Layout from "./pages/layout/Layout";
import Chat from "./pages/chat/Chat";
import Summarize from "./pages/summarize/Summarize";
import { LanguageContextProvider } from "./components/LanguageSelector/LanguageContextProvider";
import Brainstorm from "./pages/brainstorm/Brainstorm";
import Faq from "./pages/faq/Faq";
import Version from "./pages/version/Version";
import Menu from "./pages/menu/Menu";
import { LLMContextProvider } from "./components/LLMSelector/LLMContextProvider";
import Simply from "./pages/simplyfied-language/Simply";
import Bot from "./pages/bot/Bot";
import { QuickPromptProvider } from "./components/QuickPrompt/QuickPromptProvider";
initializeIcons();

const router = createHashRouter([
    {
        path: "/",
        element: <Layout />,
        errorElement: <div>Error</div>,
        children: [
            {
                index: true,
                element: <Menu />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "chat",
                element: <Chat />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "sum",
                element: <Summarize />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "brainstorm",
                element: <Brainstorm />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "faq",
                element: <Faq />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "version",
                element: <Version />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "simply",
                element: <Simply />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "bot/:id",
                element: <Bot />,
                errorElement: <div>Fehler</div>
            },
            /** {
                 path: "qa",
                 lazy: () => import("./pages/oneshot/OneShot")
             }, */
            {
                path: "*",
                lazy: () => import("./pages/NoPage")
            }
        ]
    }
]);

async function enableMocking() {
    // Check if we're not in development mode or deploying ot gh pages
    if (import.meta.env?.MODE !== "development" && import.meta.env?.MODE !== "ghpages") {
        return;
    }
    const { worker } = await import("./mocks/browser.js");

    // `worker.start()` returns a Promise that resolves
    // once the Service Worker is up and ready to intercept requests.
    if (import.meta.env?.MODE === "development") return worker.start();
    else
        return worker.start({
            serviceWorker: {
                // This is useful if your application follows
                // a strict directory structure.
                url: "/mucgpt/mockServiceWorker.js"
            }
        });
}

enableMocking().then(() => {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
        <React.StrictMode>
            <LanguageContextProvider>
                <LLMContextProvider>
                    <QuickPromptProvider>
                        <RouterProvider router={router} />
                    </QuickPromptProvider>
                </LLMContextProvider>
            </LanguageContextProvider>
        </React.StrictMode>
    );
});
