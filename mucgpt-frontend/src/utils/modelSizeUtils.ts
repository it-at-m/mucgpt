export async function fetchModelFileSizes(modelId: string): Promise<Record<string, number>> {
    try {
        const response = await fetch(`https://huggingface.co/api/models/${encodeURIComponent(modelId)}/tree/main`, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`HF API error: ${response.status}`);

        const data = (await response.json()) as Array<{ type: "file" | "dir"; name: string; size?: number }>;
        const sizes: Record<string, number> = {};
        for (const entry of data) {
            if (entry.type === "file" && entry.size) {
                sizes[entry.name] = entry.size;
            }
        }
        return sizes;
    } catch (err) {
        console.error(`Failed to fetch file sizes for ${modelId}:`, err);
        return {};
    }
}
