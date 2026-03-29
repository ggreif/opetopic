<script lang="ts">
  import { getConnect2ICContext, useConnect } from '../lib/connect2ic'

  let { dark = false, style = '' }: { dark?: boolean, style?: string } = $props()

  const { client, dialog } = getConnect2ICContext()
  const { isConnected, disconnect, connect } = useConnect(client)

  function handleClick() {
    if ($isConnected) {
      disconnect()
    } else {
      dialog.open()
    }
  }
</script>

<button class="connect-button" {style} onclick={handleClick}>
  {$isConnected ? 'Disconnect' : 'Connect'}
</button>
