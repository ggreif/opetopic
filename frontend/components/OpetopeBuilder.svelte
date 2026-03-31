<script lang="ts">
  import * as d3 from 'd3'
  import OpetopeEditor from './OpetopeEditor.svelte'
  import { simplex, arrow, point, boxtree, cell, sourceExtrude, subtreeFor, dropInsert, type AtomicDiagram } from '../lib/opetope'

  // Auto-label counter: cycles through α β γ δ ε ζ η θ ι κ … then x₀ x₁ …
  const _greek = ['α','β','γ','δ','ε','ζ','η','θ','ι','κ','λ','μ','ν','ξ','ο','π']
  let _labelIdx = 0
  function freshLabel(): string {
    const i = _labelIdx++
    return i < _greek.length ? _greek[i] : `x${i - _greek.length}`
  }

  // Focus.root starts as the outer frame only (single leaf = root cell, no sub-boxes).
  // Focus.edgeRoot is the full substrate tree shown in the Prev pane.
  function withOuterFrame(diagram: AtomicDiagram): AtomicDiagram {
    const src = diagram.edgeRoot.cell
    return { edgeRoot: diagram.edgeRoot, root: { cell: cell(freshLabel(), src.dim), children: null }, drops: [] }
  }

  let focus = $state<AtomicDiagram>(withOuterFrame(boxtree()))

  // Example gallery switcher
  const examples: { label: string; make: () => AtomicDiagram }[] = [
    { label: 'Boxtree',          make: () => boxtree() },
    { label: 'Simplex (2-cell)', make: () => simplex() },
    { label: 'Arrow (1-cell)',   make: () => arrow() },
    { label: 'Point (0-cell)',   make: () => point() },
  ]

  function loadExample(make: () => AtomicDiagram) {
    focus = withOuterFrame(make())
  }

  function handleSourceExtrude(leafId: string) {
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

    // Source extrusion modifies edgeRoot (Prev substrate); root (Focus) is unchanged
    const newEdgeRoot = sourceExtrude(focus.edgeRoot, leafId, newCell)
    focus = { ...focus, edgeRoot: newEdgeRoot }

    // Navigate to newCell through the reactive $state proxy so mutations trigger Svelte reactivity
    const reactiveCell = subtreeFor(focus.edgeRoot, newCell.id)!.cell
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
    // Create a fresh lollipop cell for the new child in root
    const newCell = cell(freshLabel(), 0)
    focus = dropInsert(focus, edgeCellId, newCell)
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

  <OpetopeEditor {focus} onsourceextrude={handleSourceExtrude} ondropinsert={handleDropInsert} />
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
