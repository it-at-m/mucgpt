export const DEFAULT_TOAST_TIMEOUT = 5000;

export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface ToastMessage {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    timeout?: number;
    dismissible?: boolean;
    showIcon?: boolean;
    persistent?: boolean;
}

export type ShowToastOptions = Omit<ToastMessage, "id"> & { id?: string };

export type UpdateToastOptions = Partial<Omit<ToastMessage, "id">>;

export type ToastDisplayOptions = Pick<ShowToastOptions, "timeout" | "dismissible" | "showIcon" | "persistent">;
