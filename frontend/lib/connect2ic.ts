/**
 * Svelte 5 replacement for @connect2ic/svelte.
 * Uses @connect2ic/core directly (XState v4 service, framework-agnostic).
 */
import { readable, derived } from 'svelte/store'
import { getContext, setContext } from 'svelte'

// Shared context key (mirrors @connect2ic/svelte's internal Symbol)
const CTX = Symbol('connect2ic')

export type Client = ReturnType<typeof import('@connect2ic/core').createClient>

export type Connect2ICContext = {
  client: Client
  dialog: {
    open: () => void
    close: () => void
    isOpen: import('svelte/store').Writable<boolean>
  }
}

export function getConnect2ICContext(): Connect2ICContext {
  return getContext(CTX)
}

export function setConnect2ICContext(ctx: Connect2ICContext) {
  setContext(CTX, ctx)
}

/** Create a reactive Svelte store from an XState v4 service. */
function fromService<T>(service: { subscribe: (cb: (s: T) => void) => { unsubscribe: () => void }; getSnapshot: () => T }) {
  return readable<T>(service.getSnapshot(), (set) => {
    const sub = service.subscribe((s) => set(s))
    return () => sub.unsubscribe()
  })
}

export function useConnect(client: Client) {
  const state = fromService(client._service as any)

  const isConnected = derived(state, (s: any) => s.matches({ idle: 'connected' }) ?? false)
  const isConnecting = derived(state, (s: any) => s.matches({ idle: 'connecting' }) ?? false)
  const isDisconnecting = derived(state, (s: any) => s.matches({ idle: 'disconnecting' }) ?? false)
  const isInitializing = derived(state, (s: any) => s.matches({ idle: 'intializing' }) ?? false)
  const isIdle = derived(state, (s: any) => s.matches({ idle: 'idle' }) ?? false)
  const principal = derived(state, (s: any) => s.context.principal)
  const activeProvider = derived(state, (s: any) => s.context.activeProvider)
  const providers = derived(state, (s: any) => s.context.providers ?? [])

  return {
    isConnected,
    isConnecting,
    isDisconnecting,
    isInitializing,
    isIdle,
    principal,
    activeProvider,
    providers,
    connect: (providerId: string) => client.connect(providerId),
    disconnect: () => client.disconnect(),
  }
}
