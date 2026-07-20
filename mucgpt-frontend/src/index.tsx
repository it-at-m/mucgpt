import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import "./i18n";

import "@fontsource/montserrat/latin-700.css";
import "./index.css";

import Layout from "./pages/layout/Layout";
import Chat from "./pages/chat/Chat";
import { LanguageContextProvider } from "./components/LanguageSelector/LanguageContextProvider";
import Version from "./pages/version/Version";
import Tutorials from "./pages/tutorials/Tutorials";
import { LLMContextProvider } from "./components/LLMSelector/LLMContextProvider";
import { FollowUpActionProvider } from "./components/FollowUpAction";
import LocalAssistant from "./pages/assistant/LocalAssistant";
import OwnedCommunityAssistant from "./pages/assistant/OwnedCommunityAssistant";
import CommunityAssistant from "./pages/assistant/CommunityAssistant";
import { GlobalToastProvider } from "./components/GlobalToastHandler/GlobalToastContext";
import DeletedCommunityAssistant from "./pages/assistant/DeletedCommunityAssistant";
import Unauthorized from "./pages/Unauthorized";
import Discovery from "./pages/discovery/Discovery";
import Home from "./pages/home/Home";
import { AssistantEditorPage } from "./components/AssistantDialogs/AssistantEditorPage/AssistantEditorPage";

async function cleanupServiceWorkerForGatewayBuild() {
    const pwaEnabled = import.meta.env.VITE_DISABLE_PWA !== "true";
    if (import.meta.env.MODE === "development" || pwaEnabled || !("serviceWorker" in navigator)) {
        return;
    }

    const hadController = Boolean(navigator.serviceWorker.controller);
    const registrations = await navigator.serviceWorker.getRegistrations();
    if (registrations.length === 0) {
        return;
    }

    await Promise.all(registrations.map(registration => registration.unregister()));

    if ("caches" in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    }

    if (hadController) {
        window.location.reload();
    }
}

const router = createHashRouter([
    {
        path: "/",
        element: <Layout />,
        errorElement: <div>Error</div>,
        children: [
            {
                index: true,
                element: <Home />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "unauthorized",
                element: <Unauthorized />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "chat",
                element: <Chat />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "discovery",
                element: <Discovery />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "tutorials",
                element: <Tutorials />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "tutorials/ki-basics",
                element: <Tutorials />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "tutorials/tools",
                element: <Tutorials />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "tutorials/brainstorm",
                element: <Tutorials />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "tutorials/simplify",
                element: <Tutorials />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "tutorials/tips",
                element: <Tutorials />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "version",
                element: <Version />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "assistant/create",
                element: <AssistantEditorPage mode="create" />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "assistant/:id",
                element: <LocalAssistant />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "assistant/:id/edit",
                element: <LocalAssistant />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "owned/communityassistant/:id",
                element: <OwnedCommunityAssistant />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "owned/communityassistant/:id/edit",
                element: <OwnedCommunityAssistant />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "deleted/communityassistant/:id",
                element: <DeletedCommunityAssistant />,
                errorElement: <div>Fehler</div>
            },
            {
                path: "communityassistant/:id",
                element: <CommunityAssistant />,
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

Promise.all([cleanupServiceWorkerForGatewayBuild(), enableMocking()]).then(() => {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
        <React.StrictMode>
            <GlobalToastProvider>
                <LanguageContextProvider>
                    <LLMContextProvider>
                        <FollowUpActionProvider>
                            <RouterProvider router={router} />
                        </FollowUpActionProvider>
                    </LLMContextProvider>
                </LanguageContextProvider>
            </GlobalToastProvider>
        </React.StrictMode>
    );
});
