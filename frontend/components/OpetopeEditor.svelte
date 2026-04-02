<script lang="ts">
  import BoxDiagram from './BoxDiagram.svelte'
  import TreeDiagram from './TreeDiagram.svelte'
  import AtomicDiagramView from './AtomicDiagramView.svelte'
  import { collectDrops, computeSucc, type AtomicDiagram } from '../lib/opetope'

  let {
    focus,
    oncellclick = undefined,
    onsourceextrude = undefined,
    ondropinsert = undefined,
    onencircle = undefined,
  }: {
    focus: AtomicDiagram
    oncellclick?: (cellId: string) => void
    onsourceextrude?: (leafId: string) => void
    ondropinsert?: (cellId: string) => void
    onencircle?: (cellId: string) => void
  } = $props()

  let hoveredId     = $state<string | null>(null)  // Prev / Focus hover → edge highlighting
  let succHoveredId = $state<string | null>(null)  // Succ hover → node highlighting in Focus
  let selectedId    = $state<string | null>(null)

  const drops = $derived(collectDrops(focus.edgeRoot))

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
      highlightNode={succHoveredId ?? undefined}
      selected={selectedId ?? undefined}
      onhover={(id) => { hoveredId = id }}
      onnodehover={(id) => { succHoveredId = id }}
      onselect={(id) => { selectedId = id ?? null }}
      ondropinsert={(cellId) => ondropinsert?.(cellId)}
      onencircle={(cellId) => onencircle?.(cellId)}
    />
  </div>

  <!-- Succ pane: computeSucc(focus.root) as tree; hidden when focus.root is null -->
  {#if focus.root}
  <div class="pane succ-pane">
    <div class="pane-label">succ</div>
    <TreeDiagram
      tree={computeSucc(focus.root)}
      drops={[]}
      width={280}
      height={340}
      highlight={selectedId ?? succHoveredId ?? undefined}
      onhover={(id) => { succHoveredId = id }}
      oncellclick={handleCellClick}
    />
  </div>
  {/if}
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
