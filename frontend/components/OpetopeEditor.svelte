<script lang="ts">
  import BoxDiagram from './BoxDiagram.svelte'
  import OpetopeDiagram from './OpetopeDiagram.svelte'
  import type { AtomicDiagram } from '../lib/opetope'

  let {
    focus,
    oncellclick = undefined,
  }: {
    focus: AtomicDiagram
    oncellclick?: (cellId: string) => void
  } = $props()

  function handleCellClick(cellId: string) {
    console.log('cell clicked:', cellId)
    oncellclick?.(cellId)
  }
</script>

<div class="editor">
  <!-- Focus pane: box/containment view of focus.root -->
  <div class="pane focus-pane">
    <div class="pane-label">boxes</div>
    <BoxDiagram tree={focus.root} width={420} height={340} />
  </div>

  <!-- Succ pane: edge/tree view of focus.edgeRoot -->
  <div class="pane succ-pane">
    <div class="pane-label">tree</div>
    <OpetopeDiagram
      diagram={focus}
      width={320}
      height={340}
      oncellclick={handleCellClick}
    />
  </div>
</div>

<style>
  .editor {
    display: flex;
    gap: 20px;
    align-items: flex-start;
    padding: 8px 0;
  }

  .pane {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .succ-pane {
    opacity: 0.8;
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
</style>
