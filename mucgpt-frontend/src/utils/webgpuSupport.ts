export function supportsWebGPU(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
}
