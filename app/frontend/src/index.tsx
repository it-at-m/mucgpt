import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import { initializeIcons } from "@fluentui/react";

import "./index.css";

import Layout from "./pages/layout/Layout";
import Chat from "./pages/chat/Chat";
import Summarize from "./pages/summarize/Summarize";
import { LanguageContextProvider } from "./components/LanguageSelector/LanguageContextProvider";
import Brainstorm from "./pages/brainstorm/Brainstorm";
initializeIcons();

const router = createHashRouter([
    {
        path: "/",
        element: <Layout />,
        children: [
            {
                index: true,
                element: <Chat />
            },
            {
                path: "sum",
                element: <Summarize />
            },
            {
                path: "brainstorm",
                element: <Brainstorm />
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
