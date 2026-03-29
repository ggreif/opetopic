<script lang="ts">
  import { writable } from 'svelte/store'
  import { setConnect2ICContext, type Client } from '../lib/connect2ic'

  let { client, children }: { client: Client, children?: any } = $props()

  const isOpen = writable(false)
  const dialog = {
    open: () => isOpen.set(true),
    close: () => isOpen.set(false),
    isOpen,
  }

  // client is intentionally captured once — context is set up once on mount
  setConnect2ICContext({ client, dialog })
</script>

{@render children?.()}
