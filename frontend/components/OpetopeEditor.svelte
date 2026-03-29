<script lang="ts">
  import OpetopeDiagram from './OpetopeDiagram.svelte'
  import type { AtomicDiagram } from '../lib/opetope'

  let {
    focus,
    prev = undefined,
    succ = undefined,
    onfocuschange = undefined,
  }: {
    focus: AtomicDiagram
    prev?: AtomicDiagram
    succ?: AtomicDiagram
    onfocuschange?: (diagram: AtomicDiagram) => void
  } = $props()

  function handleCellClick(cellId: string) {
    // For now: log the click. Phase 2 will navigate the complex.
    console.log('cell clicked:', cellId)
  }
</script>

<div class="editor">
  <div class="pane prev-pane">
    <div class="pane-label">prev</div>
    {#if prev}
      <OpetopeDiagram diagram={prev} width={300} height={280} />
    {:else}
      <div class="pane-empty">—</div>
    {/if}
  </div>

  <div class="pane focus-pane">
    <div class="pane-label">focus</div>
    <OpetopeDiagram
      diagram={focus}
      width={380}
      height={340}
      oncellclick={handleCellClick}
    />
  </div>

  <div class="pane succ-pane">
    <div class="pane-label">succ</div>
    {#if succ}
      <OpetopeDiagram diagram={succ} width={300} height={280} />
    {:else}
      <div class="pane-empty">—</div>
    {/if}
  </div>
</div>

<style>
  .editor {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 8px 0;
  }

  .pane {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .focus-pane {
    flex-shrink: 0;
  }

  .prev-pane, .succ-pane {
    opacity: 0.65;
    flex-shrink: 0;
  }

  .pane-label {
    font-size: 0.75em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #888;
    text-align: center;
  }

  .pane-empty {
    width: 300px;
    height: 280px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2em;
    color: #ccc;
    border: 1px dashed #e0e0e0;
    border-radius: 8px;
    background: #fafafa;
  }
</style>
