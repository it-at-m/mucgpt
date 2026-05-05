export async function fetchModelFileSizes(modelId: string): Promise<Record<string, number>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
        const response = await fetch(`https://huggingface.co/api/models/${modelId}/tree/main/onnx`, {
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
