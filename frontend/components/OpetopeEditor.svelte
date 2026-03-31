<script lang="ts">
  import BoxDiagram from './BoxDiagram.svelte'
  import TreeDiagram from './TreeDiagram.svelte'
  import AtomicDiagramView from './AtomicDiagramView.svelte'
  import type { AtomicDiagram } from '../lib/opetope'

  let {
    focus,
    oncellclick = undefined,
    onsourceextrude = undefined,
    ondropinsert = undefined,
  }: {
    focus: AtomicDiagram
    oncellclick?: (cellId: string) => void
    onsourceextrude?: (leafId: string) => void
    ondropinsert?: (cellId: string) => void
  } = $props()

  let hoveredId = $state<string | null>(null)

  const drops = $derived(focus.drops)

  function handleCellClick(cellId: string) {
    oncellclick?.(cellId)
  }
</script>

<div class="editor">
  <!-- Prev pane: substrate as BoxDiagram; slashed box where drop latches on -->
  <div class="pane prev-pane">
    <div class="pane-label">prev</div>
    <BoxDiagram
      tree={focus.edgeRoot}
      width={280}
      height={340}
      highlight={hoveredId ?? undefined}
      onhover={(id) => { hoveredId = id }}
      onsourceextrude={(leafId) => onsourceextrude?.(leafId)}
    />
  </div>

  <!-- Focus pane: atomic diagram — tree (left bond) + boxes (right bond) -->
  <div class="pane focus-pane">
    <div class="pane-label">focus</div>
    <AtomicDiagramView
      diagram={focus}
      {drops}
      highlight={hoveredId ?? undefined}
      onhover={(id) => { hoveredId = id }}
      ondropinsert={(cellId) => ondropinsert?.(cellId)}
    />
  </div>

  <!-- Succ pane: focus.root as tree; lollipops where drops were inserted -->
  <div class="pane succ-pane">
    <div class="pane-label">succ</div>
    <TreeDiagram
      tree={focus.root}
      drops={[]}
      width={280}
      height={340}
      highlight={hoveredId ?? undefined}
      onhover={(id) => { hoveredId = id }}
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

  .prev-pane, .succ-pane {
    opacity: 0.85;
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
