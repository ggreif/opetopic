<script lang="ts">
  import BoxDiagram from './BoxDiagram.svelte'
  import AtomicDiagramView from './AtomicDiagramView.svelte'
  import { collectDrops, computeSucc, minConnectedSubtree, isValidEncircleSet, type AtomicDiagram } from '../lib/opetope'
  import { store } from '../lib/diagramStore.svelte'
  import { validateStack } from '../lib/validate'

  let {
    oncellclick = undefined,
    onsourceextrude = undefined,
    ondropinsert = undefined,
    onbaredropinsert = undefined,
    onencircle = undefined,
  }: {
    oncellclick?: (cellId: string) => void
    onsourceextrude?: (leafId: string) => void
    ondropinsert?: (cellId: string) => void
    onbaredropinsert?: (cellId: string) => void
    onencircle?: (cellIds: Set<string>) => void
  } = $props()

  let hoveredId     = $state<string | null>(null)
  let succHoveredId = $state<string | null>(null)
  let selectedIds   = $state<Set<string>>(new Set())

  const violation     = $derived(validateStack(store.diagrams))
  const hardViolation = $derived(violation && !violation.includes('ADVISORY') ? violation : null)
  const drops         = $derived(collectDrops(store.focus.edgeRoot))

  // Map lollipop cell ID → its branch ID in focus.root (for bond hover via cell ID)
  const lolliCellToBranchId = $derived((() => {
    const m = new Map<string, string>()
    function walk(t: import('../lib/opetope').Tree) {
      if (!t.children) return
      for (const [bid, child] of t.children) {
        if (child.children !== null && child.children.length === 0) m.set(child.cell.id, bid)
        walk(child)
      }
    }
    if (store.focus.root) walk(store.focus.root)
    return m
  })())

  // Inverse: branch ID → lollipop cell ID (for bond hover from Focus drop box → Succ stem)
  const branchToLolliCell = $derived(new Map([...lolliCellToBranchId].map(([cellId, bid]) => [bid, cellId])))

  $effect(() => { if (violation) console.log('[validateStack]', violation) })

  // Succ AtomicDiagram:
  //   1. null                               → hide pane (no box tree)
  //   2. store.succDiagram                  → next level already exists, show verbatim
  //   3. { edgeRoot: computeSucc(root), root: null } → preview before first hop right
  const succAtomicDiagram = $derived<AtomicDiagram | null>(
    !store.focus.root ? null
    : store.succDiagram
      ?? { edgeRoot: computeSucc(store.focus.root), root: null }
  )

  const canHopLeft  = $derived(store.focusIdx > 0)
  const canHopRight = $derived(store.focus.root !== null)

  function handleCellClick(cellId: string) {
    oncellclick?.(cellId)
  }

  function handleSelect(id: string | null, add = false) {
    if (id === null) { selectedIds = new Set(); return }
    if (add) {
      const candidate = new Set([...selectedIds, id])
      const extended  = minConnectedSubtree(store.focus.edgeRoot, candidate)
      if (isValidEncircleSet(store.focus.edgeRoot, extended)) {
        selectedIds = extended
      } else {
        selectedIds = new Set([id])  // multi-select invalid — fall back to single select
      }
    } else {
      selectedIds = new Set([id])
    }
  }

  function onHopLeft() {
    hoveredId = null; succHoveredId = null; selectedIds = new Set()
    store.hopLeft()
  }

  function onHopRight() {
    hoveredId = null; succHoveredId = null; selectedIds = new Set()
    store.hopRight()
  }
</script>

<svelte:window onclick={(e) => { if (!e.ctrlKey) selectedIds = new Set() }} />

<div class="editor">
  <!-- Prev pane -->
  <div class="pane prev-pane">
    <div class="pane-label">prev</div>
    <BoxDiagram
      tree={store.focus.edgeRoot}
      width={280}
      height={340}
      highlight={hoveredId ?? undefined}
      onhover={(id) => { hoveredId = id }}
      onsourceextrude={(leafId) => onsourceextrude?.(leafId)}
    />
    <div class="dim-badge">dim {store.focus.edgeRoot.cell.dim}</div>
  </div>

  <!-- ◀ hop left -->
  <button class="hop-arrow" disabled={!canHopLeft} onclick={onHopLeft}>◀</button>

  <!-- Focus pane -->
  <div class="pane focus-pane" class:violated={!!hardViolation}>
    <div class="pane-label">focus</div>
    <AtomicDiagramView
      diagram={store.focus}
      {drops}
      highlight={hoveredId ?? undefined}
      highlightNode={(succHoveredId ? (lolliCellToBranchId.get(succHoveredId) ?? succHoveredId) : undefined)}
      selected={selectedIds}
      onhover={(id) => { hoveredId = id }}
      onnodehover={(id) => { succHoveredId = id }}
      onselect={handleSelect}
      ondropinsert={(cellId) => ondropinsert?.(cellId)}
      onbaredropinsert={(cellId) => onbaredropinsert?.(cellId)}
      onencircle={(ids) => { onencircle?.(ids); selectedIds = new Set() }}
    />
    {#if hardViolation}
      <div class="violation-msg" title={hardViolation}>⚠ invalid</div>
    {/if}
    <div class="dim-badge">dim {store.focus.root?.cell.dim ?? store.focus.edgeRoot.cell.dim + 1}</div>
  </div>

  <!-- ▶ hop right -->
  <button class="hop-arrow" disabled={!canHopRight} onclick={onHopRight}>▶</button>

  <!-- Succ pane -->
  {#if succAtomicDiagram}
  <div class="pane succ-pane">
    <div class="pane-label">succ</div>
    <AtomicDiagramView
      diagram={succAtomicDiagram}
      drops={collectDrops(succAtomicDiagram.edgeRoot)}
      width={280}
      height={340}
      highlight={succHoveredId ? (branchToLolliCell.get(succHoveredId) ?? succHoveredId) : undefined}
      highlightNode={undefined}
      selected={new Set()}
      selectionHighlightIds={selectedIds}
      onhover={(id) => { succHoveredId = id }}
      onnodehover={(id) => { succHoveredId = id }}
      onselect={undefined}
      ondropinsert={undefined}
      onencircle={undefined}
    />
    <div class="dim-badge">{succAtomicDiagram.root ? `dim ${succAtomicDiagram.root.cell.dim}` : `dim ${succAtomicDiagram.edgeRoot.cell.dim + 1}`}</div>
  </div>
  {/if}
</div>

<style>
  .editor {
    display: flex;
    gap: 4px;
    align-items: center;
    padding: 8px 0;
  }

  .pane {
    display: flex;
    flex-direction: column;
    gap: 4px;
    position: relative;
  }

  .prev-pane, .succ-pane {
    opacity: 0.85;
    flex-shrink: 0;
  }

  .focus-pane.violated :global(.atomic-diagram) {
    background: #fffde7;
  }

  .violation-msg {
    font-size: 0.75em;
    color: #b26a00;
    font-weight: 600;
    text-align: center;
    cursor: help;
  }

  .pane-label {
    font-size: 0.75em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #888;
    text-align: center;
  }

  .dim-badge {
    font-size: 0.7em;
    color: #aaa;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-align: right;
    padding: 1px 4px;
    user-select: none;
  }

  .hop-arrow {
    align-self: center;
    background: none;
    border: 1px solid #ccc;
    border-radius: 50%;
    width: 28px;
    height: 28px;
    font-size: 14px;
    cursor: pointer;
    color: #666;
    flex-shrink: 0;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    padding: 0;
    line-height: 1;
  }

  .hop-arrow:hover:not(:disabled) {
    background: #f3e5f5;
    color: #a02480;
    border-color: #a02480;
  }

  .hop-arrow:disabled {
    opacity: 0.3;
    cursor: default;
  }
</style>
