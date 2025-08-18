declare module "d3-graphviz" {
    interface GraphvizInstance {
        engine(engine: "dot" | "circo" | "fdp" | "neato" | "osage" | "twopi"): GraphvizInstance;
        renderDot(dot: string): GraphvizInstance;
        // Event hookup (minimal typing)
        on(event: "end", callback: () => void): GraphvizInstance;
    }
    export function graphviz(el: HTMLElement | null, options?: Record<string, unknown>): GraphvizInstance;
}
