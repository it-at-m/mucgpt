import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...(handlers as any));

export const startMockServiceWorker = () => {
    return worker.start({ onUnhandledRequest: "warn" });
};

export const stopMockServiceWorker = () => {
    worker.stop();
};
