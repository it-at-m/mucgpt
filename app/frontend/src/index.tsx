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
import { LLMContextProvider } from "./components/LLMSelector/LLMContextProvider";
import Simply from "./pages/simplyfied-language/Simply";
initializeIcons();

const router = createHashRouter([
    {
        path: "/",
        element: <Layout />,
        errorElement: <div>Error</div>,
        children: [
            {
                index: true,
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
