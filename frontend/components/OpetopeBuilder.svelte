<script lang="ts">
  import * as d3 from 'd3'
  import OpetopeEditor from './OpetopeEditor.svelte'
  import { simplex, ypsilon, point, boxtree, cell, freshId, substrate, sourceExtrude, subtreeFor, dropInsert, encircleMulti, type AtomicDiagram, type Tree, type Opetope } from '../lib/opetope'
  import { validateDiagram } from '../lib/validate'
  import { store } from '../lib/diagramStore.svelte'

  // Auto-label counter: cycles through α β γ δ ε ζ η θ ι κ … then x₀ x₁ …
  const _greek = ['α','β','γ','δ','ε','ζ','η','θ','ι','κ','λ','μ','ν','ξ','ο','π']
  let _labelIdx = 0
  function freshLabel(): string {
    const i = _labelIdx++
    return i < _greek.length ? _greek[i] : `x${i - _greek.length}`
  }

  // Build focus.root from the substrate: one leaf box per inner node (children !== null).
  // Returns focus with root = null if substrate has no inner nodes (e.g. Point).
  function withOuterFrame(diagram: AtomicDiagram): AtomicDiagram {
    const innerNodes: ReturnType<typeof cell>[] = []
    function collectInner(t: Tree) {
      if (t.children !== null) {
        innerNodes.push(t.cell)
        for (const [, child] of t.children) collectInner(child)
      }
    }
    collectInner(diagram.edgeRoot)
    if (innerNodes.length === 0) return { edgeRoot: diagram.edgeRoot, root: null }
    // Collect labels already in edgeRoot so we skip them (computeSucc preserves labels,
    // which would collide with freshLabel() if we don't check).
    const usedLabels = new Set<string>()
    function collectLabels(t: Tree) {
      usedLabels.add(t.cell.label)
      if (t.children) for (const [, c] of t.children) collectLabels(c)
    }
    collectLabels(diagram.edgeRoot)
    function safeLabel(): string {
      let label: string
      do { label = freshLabel() } while (usedLabels.has(label))
      usedLabels.add(label)
      return label
    }
    const frameCell = cell(safeLabel(), diagram.edgeRoot.cell.dim + 1)
    const children: [string, Tree][] = innerNodes.map(c =>
      [freshId(), { cell: substrate(safeLabel(), c), away: new Set(), drops: [], children: null } as Tree]
    )
    return { edgeRoot: diagram.edgeRoot, root: { cell: frameCell, away: new Set(), drops: [], children } }
  }

  // Initialise store with default example
  loadExample(boxtree)

  // Auto-create the base box whenever Focus lands on a diagram with root === null
  // but an edge tree that has inner nodes. This fires on hopRight into a new level.
  $effect(() => {
    const f = store.focus
    if (!f || f.root !== null) return
    const framed = withOuterFrame(f)
    if (framed.root !== null) store.updateFocusDiagram(framed)
  })

  function setFocus(next: AtomicDiagram) {
    const v = validateDiagram(next)
    if (v) {
      console.log('[validateDiagram] VIOLATION:', v)
      return
    }
    store.updateFocusDiagram(next)
  }

  // Example gallery switcher
  const examples: { label: string; make: () => Opetope }[] = [
    { label: 'Boxtree',          make: () => boxtree() },
    { label: 'Simplex (2-cell)', make: () => simplex() },
    { label: 'Ypsilon (2-cell)', make: () => ypsilon() },
    { label: 'Point (0-cell)',   make: () => point() },
  ]

  function loadExample(make: () => Opetope) {
    const trees = make()
    if (trees.length === 1) {
      store.resetTo(withOuterFrame({ edgeRoot: trees[0], root: null }))
      return
    }
    // Multi-level: trees[i+1] serves as root for diagrams[i] — the bond holds
    // because computeSucc(trees[i+1]) has the same structure as trees[i+1].
    const diagrams: AtomicDiagram[] = trees.slice(0, -1).map((t, i) => ({ edgeRoot: t, root: trees[i + 1] }))
    diagrams.push(withOuterFrame({ edgeRoot: trees[trees.length - 1], root: null }))
    store.resetToStack(diagrams, 0)
  }

  function handleSourceExtrude(leafId: string) {
    const focus = store.focus
    // Find the dim of the extruded leaf so the new child has dim - 1
    function findDim(tree: typeof focus.edgeRoot): number {
      if (tree.cell.id === leafId) return tree.cell.dim
      if (tree.children === null) return -1
      for (const [, child] of tree.children) {
        const d = findDim(child)
        if (d >= 0) return d
      }
      return -1
    }
    const parentDim = findDim(focus.edgeRoot)
    const newCell = cell(freshLabel(), Math.max(0, parentDim - 1))

    // Source extrusion modifies edgeRoot; also adds a leaf box to focus.root for the
    // newly-inner node (leafId turns from a leaf into an inner node).
    const newEdgeRoot = sourceExtrude(focus.edgeRoot, leafId, newCell)
    const newlyInnerCell = subtreeFor(newEdgeRoot, leafId)!.cell
    const newLeafBox: Tree = { cell: { ...newlyInnerCell, label: freshLabel() }, away: new Set(), drops: [], children: null }
    const oldRoot = focus.root
    let newRoot: Tree
    if (!oldRoot) {
      // Point case: first inner node → create outer frame
      const frameCell = cell(freshLabel(), newlyInnerCell.dim + 1)
      newRoot = { cell: frameCell, away: new Set(), drops: [], children: [[freshId(), newLeafBox]] }
    } else if (oldRoot.children === null) {
      newRoot = { ...oldRoot, children: [[freshId(), newLeafBox]] }
    } else {
      newRoot = { ...oldRoot, children: [...oldRoot.children, [freshId(), newLeafBox]] }
    }
    setFocus({ edgeRoot: newEdgeRoot, root: newRoot })

    // Navigate to newCell through the reactive $state proxy so mutations trigger Svelte reactivity
    const reactiveCell = subtreeFor(store.focus.edgeRoot, newCell.id)!.cell
    reactiveCell.nascent = 0.05  // immediately perceptible

    // Grow nascent 0.05 → 1 over ~500ms
    const STEPS = 30
    d3.timer((elapsed) => {
      const step = Math.min(STEPS, Math.round(elapsed / (500 / STEPS)))
      reactiveCell.nascent = Math.max(0.05, step / STEPS)
      if (step >= STEPS) {
        delete (reactiveCell as any).nascent  // cell is now mature
        return true
      }
    })
  }

  function handleDropInsert(edgeCellId: string) {
    const focus = store.focus
    // Create a fresh lollipop cell for the new child in root
    const newCell = cell(freshLabel(), 0)
    const branchId = freshId()  // shared between dropId and root branch key
    const newFocus = dropInsert(focus, edgeCellId, newCell, branchId)
    if (newFocus.root) {
      setFocus(newFocus)
    } else {
      // Point case: focus.root was null → create outer frame with lollipop as first child
      const frameCell = cell(freshLabel(), newFocus.edgeRoot.cell.dim + 1)
      const lollipop: Tree = { cell: newCell, away: new Set(), drops: [], children: [] }
      setFocus({ ...newFocus, root: { cell: frameCell, away: new Set(), drops: [], children: [[branchId, lollipop]] } })
    }
  }

  function handleEncircle(cellIds: Set<string>) {
    const focus = store.focus
    if (!focus.root || cellIds.size === 0) return
    // Use any member to determine dimension — search edgeRoot first, then root
    const anyId = [...cellIds][0]
    const sub = subtreeFor(focus.edgeRoot, anyId) ?? subtreeFor(focus.root, anyId)
    if (!sub) return
    const next = encircleMulti(focus, cellIds, cell(freshLabel(), sub.cell.dim + 1))
    if (next !== focus) setFocus(next)
  }
</script>

<section class="builder">
  <h2>Opetope Builder <span class="badge">experimental</span></h2>
  <p class="desc">
    Prev: substrate edge tree. Focus: atomic diagram (right-click leaf box → source extrude; double-click edge in Succ → add drop). Succ: bonded edge tree.
  </p>

  <div class="toolbar">
    <span class="toolbar-label">Examples:</span>
    {#each examples as ex}
      <button class="ex-btn" onclick={() => loadExample(ex.make)}>{ex.label}</button>
    {/each}
  </div>

  <OpetopeEditor onsourceextrude={handleSourceExtrude} ondropinsert={handleDropInsert} onencircle={handleEncircle} />
</section>

<style>
  .builder {
    padding: 24px 40px 40px;
    max-width: 1200px;
  }

  h2 {
    font-size: 1.4em;
    margin-bottom: 6px;
    color: #333;
  }

  .badge {
    font-size: 0.5em;
    background: #f3e5f5;
    color: #7b1fa2;
    padding: 2px 8px;
    border-radius: 4px;
    vertical-align: middle;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .desc {
    color: #666;
    font-size: 0.9em;
    margin-bottom: 16px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }

  .toolbar-label {
    font-size: 0.85em;
    color: #888;
    font-weight: 600;
  }

  .ex-btn {
    padding: 5px 14px;
    border: 1px solid #bbb;
    border-radius: 20px;
    background: white;
    cursor: pointer;
    font-size: 0.85em;
    transition: background 0.15s, border-color 0.15s;
  }

  .ex-btn:hover {
    background: #f3e5f5;
    border-color: #a02480;
    color: #a02480;
  }
</style>
