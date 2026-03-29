"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConnect2ICContext = getConnect2ICContext;
exports.setConnect2ICContext = setConnect2ICContext;
exports.useConnect = useConnect;
/**
 * Svelte 5 replacement for @connect2ic/svelte.
 * Uses @connect2ic/core directly (XState v4 service, framework-agnostic).
 */
const store_1 = require("svelte/store");
const svelte_1 = require("svelte");
// Shared context key (mirrors @connect2ic/svelte's internal Symbol)
const CTX = Symbol('connect2ic');
function getConnect2ICContext() {
    return (0, svelte_1.getContext)(CTX);
}
function setConnect2ICContext(ctx) {
    (0, svelte_1.setContext)(CTX, ctx);
}
/** Create a reactive Svelte store from an XState v4 service. */
function fromService(service) {
    return (0, store_1.readable)(service.getSnapshot(), (set) => {
        const sub = service.subscribe((s) => set(s));
        return () => sub.unsubscribe();
    });
}
function useConnect(client) {
    const state = fromService(client._service);
    const isConnected = (0, store_1.derived)(state, (s) => s.matches({ idle: 'connected' }) ?? false);
    const isConnecting = (0, store_1.derived)(state, (s) => s.matches({ idle: 'connecting' }) ?? false);
    const isDisconnecting = (0, store_1.derived)(state, (s) => s.matches({ idle: 'disconnecting' }) ?? false);
    const isInitializing = (0, store_1.derived)(state, (s) => s.matches({ idle: 'intializing' }) ?? false);
    const isIdle = (0, store_1.derived)(state, (s) => s.matches({ idle: 'idle' }) ?? false);
    const principal = (0, store_1.derived)(state, (s) => s.context.principal);
    const activeProvider = (0, store_1.derived)(state, (s) => s.context.activeProvider);
    const providers = (0, store_1.derived)(state, (s) => s.context.providers ?? []);
    return {
        isConnected,
        isConnecting,
        isDisconnecting,
        isInitializing,
        isIdle,
        principal,
        activeProvider,
        providers,
        connect: (providerId) => client.connect(providerId),
        disconnect: () => client.disconnect(),
    };
}
//# sourceMappingURL=connect2ic.js.map