export const copyRichText = async (html: string, plainText: string): Promise<void> => {
    try {
        await navigator.clipboard.write([
            new ClipboardItem({
                "text/html": new Blob([html], { type: "text/html" }),
                "text/plain": new Blob([plainText], { type: "text/plain" })
            })
        ]);
    } catch {
        await navigator.clipboard.writeText(plainText);
    }
};

export const serializeForClipboard = (element: HTMLElement): string => {
    const clone = element.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("[data-clipboard-ignore]").forEach(node => node.remove());
    return clone.outerHTML;
};
