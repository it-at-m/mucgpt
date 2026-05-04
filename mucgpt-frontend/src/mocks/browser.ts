import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...(handlers as any));

export const startMockServiceWorker = () => {
    worker.start({ onUnhandledRequest: () => {} });
};

export const stopMockServiceWorker = () => {
    worker.stop();
};
