export interface ToolStatus {
    name: string;
    message: string;
    state: "STARTED" | "ENDED" | null;
    timestamp: number;
}

export interface ToolBuffer {
    name: string;
    content: string;
    status: {
        message: string;
        state: "STARTED" | "ENDED" | null;
        timestamp: number;
    };
    isActive: boolean;
}

export enum ToolStreamState {
    STARTED = "STARTED",
    ENDED = "ENDED",
    UPDATE = "UPDATE",
    APPEND = "APPEND",
    ROLLBACK = "ROLLBACK"
}

export class ToolStreamHandler {
    private toolBuffers: Map<string, ToolBuffer> = new Map();

    handleToolCall(toolCall: { name: string; state: string; content: string }): {
        updatedBuffer: ToolBuffer;
        statusChange: boolean;
    } {
        const { name, state, content } = toolCall;
        const normalizedName = name.toLowerCase();

        // Get or create buffer for this tool
        if (!this.toolBuffers.has(normalizedName)) {
            this.toolBuffers.set(normalizedName, {
                name,
                content: "",
                status: {
                    message: "",
                    state: null,
                    timestamp: Date.now()
                },
                isActive: false
            });
        }

        const buffer = this.toolBuffers.get(normalizedName)!;
        let statusChange = false;

        switch (state.toUpperCase()) {
            case ToolStreamState.STARTED:
                buffer.isActive = true;
                buffer.status = {
                    message: content,
                    state: "STARTED",
                    timestamp: Date.now()
                };
                statusChange = true;
                break;

            case ToolStreamState.ENDED:
                buffer.isActive = false;
                buffer.status = {
                    message: content,
                    state: "ENDED",
                    timestamp: Date.now()
                };
                statusChange = true;
                break;

            case ToolStreamState.UPDATE:
                buffer.content = content;
                break;

            case ToolStreamState.APPEND:
                buffer.content += content;
                break;

            case ToolStreamState.ROLLBACK:
                this.toolBuffers.delete(normalizedName);
                return {
                    updatedBuffer: {
                        ...buffer,
                        content: "",
                        isActive: false,
                        status: {
                            message: "Operation canceled",
                            state: "ENDED",
                            timestamp: Date.now()
                        }
                    },
                    statusChange: true
                };
        }

        return { updatedBuffer: buffer, statusChange };
    }

    getFormattedContent(): string {
        let result = "";

        for (const [, buffer] of this.toolBuffers.entries()) {
            if (buffer.content.trim()) {
                result += `\n\`\`\`MUCGPT${buffer.name}\n${buffer.content}\n\`\`\`\n`;
            }
        }

        return result;
    }

    getActiveToolStatuses(): ToolStatus[] {
        return Array.from(this.toolBuffers.values())
            .map(buffer => ({
                name: buffer.name,
                message: buffer.status.message,
                state: buffer.status.state,
                timestamp: buffer.status.timestamp
            }))
            .filter(status => status.state !== null);
    }

    clearAll(): void {
        this.toolBuffers.clear();
    }

    hasActiveTools(): boolean {
        return Array.from(this.toolBuffers.values()).some(buffer => buffer.isActive);
    }
}
