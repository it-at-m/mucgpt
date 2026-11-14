import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...(handlers as any));

export const startMockServiceWorker = () => {
    return worker.start({ onUnhandledFrame: "warn" });
};

export const stopMockServiceWorker = () => {
    worker.stop();
};

/**
 * Browsers stop idle service workers. A restarted MSW worker forgets which pages it mocks for and passes every
 * request to the real network until a reload. Hidden pages throttle MSW's keepalive, so this page re-announces
 * itself with MSW's own activation message whenever it becomes visible again.
 */
export const keepMockingActiveAfterWorkerRestarts = () => {
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") navigator.serviceWorker.controller?.postMessage("MOCK_ACTIVATE");
    });
};
