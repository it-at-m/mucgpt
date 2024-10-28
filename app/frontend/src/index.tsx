import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { initializeIcons } from "@fluentui/react";
import './i18n';


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
import CreateBot from "./pages/bot/CreateBot";
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
                errorElement: <div>Fehler</div>,
            },
            {
                path: "chat",
                element: <Chat />,
                errorElement: <div>Fehler</div>,
            },
            {
                path: "sum",
                element: <Summarize />,
                errorElement: <div>Fehler</div>,
            },
            {
                path: "brainstorm",
                element: <Brainstorm />,
                errorElement: <div>Fehler</div>,
            },
            {
                path: "faq",
                element: <Faq />,
                errorElement: <div>Fehler</div>,
            },
            {
                path: "version",
                element: <Version />,
                errorElement: <div>Fehler</div>,
            },
            {
                path: "simply",
                element: <Simply />,
                errorElement: <div>Fehler</div>,
            },
            {
                path: "bot/:id",
                element: <Bot />,
                errorElement: <div>Fehler</div>,
            },
            {
                path: "create",
                element: <CreateBot />,
                errorElement: <div>Fehler</div>,
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


ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <LanguageContextProvider>
            <LLMContextProvider>
                <RouterProvider router={router} />
            </LLMContextProvider>
        </LanguageContextProvider>
    </React.StrictMode>
);
