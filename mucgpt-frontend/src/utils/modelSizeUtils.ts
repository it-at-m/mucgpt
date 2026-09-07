/**
 * Lists file sizes of a model repo via the HuggingFace API, keyed by file name, so the
 * worker can render an accurate download progress bar. Non-critical: failures return {}.
 *
 * @param modelId repo id on the HuggingFace Hub
 * @param treePath repo subfolder holding the ONNX files (default "onnx"; empty = repo root)
 */
export async function fetchModelFileSizes(modelId: string, treePath = "onnx"): Promise<Record<string, number>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
        const tree = treePath ? `${treePath}/` : "";
        const response = await fetch(`https://huggingface.co/api/models/${modelId}/tree/main/${tree}`, {
            headers: { Accept: "application/json" },
            signal: controller.signal
        });
        clearTimeout(timer);
        if (!response.ok) throw new Error(`HF API error: ${response.status}`);

        const data = (await response.json()) as Array<{ type: "file" | "dir"; path: string; size?: number }>;
        const sizes: Record<string, number> = {};
        for (const entry of data) {
            if (entry.type === "file" && entry.size) {
                sizes[entry.path] = entry.size;
            }
        }
        return sizes;
    } catch (err) {
        clearTimeout(timer);
        console.error(`Failed to fetch file sizes for ${modelId}:`, err);
        return {};
    }
}
