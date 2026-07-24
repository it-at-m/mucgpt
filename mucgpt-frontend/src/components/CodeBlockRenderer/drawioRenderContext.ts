import { createContext, useContext } from "react";

/** When true, ```drawio fences render as diagrams. Default false (e.g. user messages). */
export const DrawioRenderContext = createContext(false);

export function useAllowDrawioRender(): boolean {
    return useContext(DrawioRenderContext);
}
