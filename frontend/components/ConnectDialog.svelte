<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { getConnect2ICContext, useConnect } from '../lib/connect2ic'

  let { dark = false, onClose = undefined }: { dark?: boolean, onClose?: () => void } = $props()

  const { client, dialog } = getConnect2ICContext()
  const { providers, connect } = useConnect(client)
  const { isOpen, close } = dialog

  function handleConnect(providerId: string) {
    connect(providerId)
    close()
  }

  function handleBackdropClick(e: MouseEvent) {
    e.stopPropagation()
  }

  onMount(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  })

  $effect(() => {
    document.body.style.overflow = $isOpen ? 'hidden' : 'unset'
  })
</script>

{#if $isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    class="dialog-styles {dark ? 'dark' : 'light'}"
    onclick={() => { onClose?.(); close() }}
  >
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="dialog-container" onclick={handleBackdropClick}>
      <div>
        {#each $providers as provider (provider.meta.id)}
          <button
            class="button-styles {provider.meta.id}-styles"
            onclick={() => handleConnect(provider.meta.id)}
          >
            <img
              class="img-styles"
              src={dark ? provider.meta.icon.dark : provider.meta.icon.light}
              alt={provider.meta.name}
            />
            <div><span class="button-label">{provider.meta.name}</span></div>
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-styles {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    background: rgba(0,0,0,0.4);
  }
  .dialog-container {
    background: white;
    border-radius: 12px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 280px;
  }
  .dark .dialog-container {
    background: #1a1a1a;
    color: white;
  }
  .button-styles {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 16px;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background: none;
    cursor: pointer;
    font-size: 1em;
  }
  .button-styles:hover {
    background: #f5f5f5;
  }
  .img-styles {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }
  .button-label {
    font-weight: 500;
  }
</style>
