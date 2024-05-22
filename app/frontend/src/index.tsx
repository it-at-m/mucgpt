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
                errorElement: <div>Error</div>,
            },
            {
                path: "sum",
                element: <Summarize />,
                errorElement: <div>Error</div>,
            },
            {
                path: "brainstorm",
                element: <Brainstorm />,
                errorElement: <div>Error</div>,
            },
            {
                path: "faq",
                element: <Faq />,
                errorElement: <div>Error</div>,
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
            <RouterProvider router={router} />
        </LanguageContextProvider>
    </React.StrictMode>
);
