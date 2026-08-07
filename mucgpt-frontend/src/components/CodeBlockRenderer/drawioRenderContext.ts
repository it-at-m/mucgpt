import { createContext, useContext } from "react";

/** When true, ```drawio fences render as diagrams. Default false (e.g. user messages). */
export type DrawioRenderContextValue = {
    allowDrawio: boolean;
    /** True while the assistant answer is still streaming. */
    isStreaming: boolean;
};

export const DrawioRenderContext = createContext<DrawioRenderContextValue>({
    allowDrawio: false,
    isStreaming: false
});

export function useDrawioRenderContext(): DrawioRenderContextValue {
    return useContext(DrawioRenderContext);
}

export function useAllowDrawioRender(): boolean {
    return useDrawioRenderContext().allowDrawio;
}
