<script lang="ts">
  import * as d3 from 'd3'
  import { tick } from 'svelte'
  import OpetopeEditor from './OpetopeEditor.svelte'
  import { simplex, ypsilon, point, boxtree, bareDrop, cell, freshId, resetIds, substrate, sourceExtrude, subtreeFor, dropInsert, encircleMulti, type AtomicDiagram, type Tree, type Opetope } from '../lib/opetope'
  import { validateDiagram } from '../lib/validate'
  import { store } from '../lib/diagramStore.svelte'
  import type { TapeStep } from '../lib/opetope-edsl'

  // Auto-label counter: cycles through α β γ δ ε ζ η θ ι κ … then x₀ x₁ …
  const _greek = ['α','β','γ','δ','ε','ζ','η','θ','ι','κ','λ','μ','ν','ξ','ο','π']
  let _labelIdx = 0
  function freshLabel(): string {
    const i = _labelIdx++
    return i < _greek.length ? _greek[i] : `x${i - _greek.length}`
  }

  // Build focus.root from the substrate: one leaf box per corolla node (inner OR lollipop).
  // Returns focus with root = null if substrate has no corolla nodes (e.g. Point).
  function withOuterFrame(diagram: AtomicDiagram, includeRootLollipop = false): AtomicDiagram {
    const innerNodes: ReturnType<typeof cell>[] = []
    function collectInner(t: Tree, isEdgeRoot = false) {
      if (t.children !== null) {  // corolla node: inner (length>0) or lollipop (length===0)
        // Skip root-level lollipop unless caller explicitly requests it (e.g. on hop arrival).
        if (!isEdgeRoot || t.children.length > 0 || includeRootLollipop) innerNodes.push(t.cell)
        for (const [, child] of t.children) collectInner(child)
      }
    }
    collectInner(diagram.edgeRoot, true)
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

  // Dump Focus diagram to console on every dimension hop.
  let _prevFocusIdx = store.focusIdx
  let _firstHopEffect = true

  // Initialise store with default example
  loadExample(boxtree)
  $effect(() => {
    const idx = store.focusIdx  // tracked reactive dependency
    dumpOpetope(`hop → level ${idx}`)
    if (!_firstHopEffect) {
      const step: TapeStep = { op: 'hop', delta: idx > _prevFocusIdx ? 1 : -1 }
      console.log('[EDSL]', JSON.stringify(step))
      _recordStep(step, true)  // $effect runs post-flush — snapshot immediately
    }
    _firstHopEffect = false
    _prevFocusIdx = idx
  })

  // Auto-create the base box whenever Focus lands on a diagram with root === null
  // but an edge tree that has inner nodes. This fires on hopRight into a new level.
  $effect(() => {
    const f = store.focus
    if (!f || f.root !== null) return
    const framed = withOuterFrame(f, true)  // includeRootLollipop: Focus invariant requires a base box
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
  type ExampleName = 'boxtree' | 'simplex' | 'ypsilon' | 'point' | 'bareDrop'
  const examples: { label: string; name: ExampleName; make: () => Opetope }[] = [
    { label: 'Boxtree',             name: 'boxtree',  make: () => boxtree() },
    { label: 'Simplex (2-cell)',    name: 'simplex',  make: () => simplex() },
    { label: 'Ypsilon (2-cell)',    name: 'ypsilon',  make: () => ypsilon() },
    { label: 'Point (0-cell)',      name: 'point',    make: () => point() },
    { label: 'Bare Drop (1-cell)',  name: 'bareDrop', make: () => bareDrop() },
  ]

  function loadExample(make: () => Opetope, name?: ExampleName) {
    _firstHopEffect = true  // suppress the hop effect fired by the store reset below
    const trees = make()
    if (trees.length === 1) {
      store.resetTo(withOuterFrame({ edgeRoot: trees[0], root: null }))
    } else {
      // Multi-level: trees[i+1] serves as root for diagrams[i] AND as edgeRoot for diagrams[i+1].
      // Use trees[i+1] directly so factory-constructed ids (drops, branch bonds) are preserved.
      const diagrams: AtomicDiagram[] = trees.slice(0, -1).map((t, i) => ({ edgeRoot: t, root: trees[i + 1] }))
      diagrams.push(withOuterFrame({ edgeRoot: trees[trees.length - 1], root: null }, true))
      store.resetToStack(diagrams, 0)
    }
    if (name) {
      const step: TapeStep = { op: 'start', example: name }
      console.log('[EDSL]', JSON.stringify(step))
      _recordStep(step)
    }
  }

  function handleSourceExtrude(leafId: string) {
    const focus = store.focus
    const _extrudedLeaf = subtreeFor(focus.edgeRoot, leafId)
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
    if (_extrudedLeaf) {
      const step: TapeStep = { op: 'extrude', label: _extrudedLeaf.cell.label }
      console.log('[EDSL]', JSON.stringify(step))
      _recordStep(step)
    }

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

  function fmtTree(t: Tree, indent = ''): string {
    const id = `@${t.cell.id}`
    const drops = t.drops === null
      ? ` bare-drop`
      : (t.drops.length ? ` drops=[${t.drops.map(d => d.dropId).join(',')}]` : '')
    if (t.children === null) return `${indent}leaf(${t.cell.label}${id}:${t.cell.dim})${drops}`
    if (t.children.length === 0) return `${indent}node(${t.cell.label}${id}:${t.cell.dim})${drops}`
    const kids = t.children.map(([bid, child]) => fmtTree(child, indent + '  ') + ` @${bid}`).join('\n')
    return `${indent}node(${t.cell.label}${id}:${t.cell.dim})${drops}\n${kids}`
  }
  function dumpOpetope(label: string) {
    console.group(`[opetope] ${label}`)
    store.diagrams.forEach((d, i) => {
      console.group(`level ${i}`)
      console.log('edgeRoot:\n' + fmtTree(d.edgeRoot))
      console.log('root:    \n' + (d.root ? fmtTree(d.root) : 'null'))
      console.groupEnd()
    })
    console.groupEnd()
  }

  function handleDropInsert(edgeCellId: string) {
    const _dropNode = subtreeFor(store.focus.edgeRoot, edgeCellId)
    dumpOpetope(`before dropInsert (edgeCellId=${edgeCellId})`)
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
    dumpOpetope(`after dropInsert (branchId=${branchId})`)
    if (_dropNode) {
      const step: TapeStep = { op: 'drop', label: _dropNode.cell.label }
      console.log('[EDSL]', JSON.stringify(step))
      _recordStep(step)
    }
  }

  function handleBareDropInsert(_leafCellId: string) {
    const focus = store.focus
    if (focus.root !== null) return  // ignore if root already exists
    const newCell = cell(freshLabel(), focus.edgeRoot.cell.dim + 1)
    const lolliTree: Tree = { cell: newCell, away: new Set(), drops: [], children: [] }
    setFocus({ ...focus, root: lolliTree })
    const step: TapeStep = { op: 'bareDrop' }
    console.log('[EDSL]', JSON.stringify(step))
    _recordStep(step)
  }

  function handleHopRight() {
    if (!store.focus?.root) return
    if (store.focusIdx + 1 < store.diagrams.length) {
      store.hopRight()  // existing level already has a proper root
      return
    }
    const newEdgeRoot = computeSucc(store.focus.root)
    const newLevel = withOuterFrame({ edgeRoot: newEdgeRoot, root: null }, true)
    store.hopRightWith(newLevel)
  }

  // ── Recording ────────────────────────────────────────────────────────────────
  let recording = $state(false)
  let _recordSteps: TapeStep[] = []
  let _recordSnapshots: string[] = []
  let _editorEl: HTMLElement | undefined  // bound to the .builder section

  function _captureSnapshot(): string {
    if (!_editorEl) return ''
    const focusSvg = _editorEl.querySelector('.focus-pane svg.atomic-diagram')
    if (!focusSvg) return ''
    // Clone and strip transient interaction classes before snapshotting
    const clone = focusSvg.cloneNode(true) as SVGElement
    clone.querySelectorAll('.highlighted, .selected').forEach(el => {
      el.classList.remove('highlighted', 'selected')
    })
    return clone.innerHTML
  }

  function startRecording() {
    _recordSteps = []
    _recordSnapshots = []
    _labelIdx = 0
    resetIds()
    recording = true
  }

  // Called directly from each handler AFTER the state update.
  // immediate=true: DOM already flushed (called from $effect) — snapshot synchronously.
  // immediate=false: called from event handler — await tick() for Svelte to flush first.
  async function _recordStep(step: TapeStep, immediate = false) {
    if (!recording) return
    _recordSteps.push(step)
    if (!immediate) await tick()
    _recordSnapshots.push(_captureSnapshot())
  }

  async function stopRecording() {
    recording = false
    await tick()  // drain any in-flight _recordStep tick() calls
    const output = {
      steps: _recordSteps,
      snapshots: _recordSnapshots,
    }
    console.group('[EDSL] Recording stopped — copy below into Tape.fromLog()')
    console.log(JSON.stringify(output, null, 2))
    console.groupEnd()
  }

  function handleEncircle(cellIds: Set<string>) {
    const focus = store.focus
    if (!focus.root || cellIds.size === 0) return
    // Use any member to determine dimension — search edgeRoot first, then root
    const anyId = [...cellIds][0]
    const sub = subtreeFor(focus.edgeRoot, anyId) ?? subtreeFor(focus.root, anyId)
    if (!sub) return
    const next = encircleMulti(focus, cellIds, cell(freshLabel(), sub.cell.dim + 1))
    if (next !== focus) {
      // Resolve labels before setFocus mutates the store
      const labels = [...cellIds].map(id => subtreeFor(focus.edgeRoot, id)?.cell.label ?? id)
      setFocus(next)
      const step: TapeStep = { op: 'encircle', labels }
      console.log('[EDSL]', JSON.stringify(step))
      _recordStep(step)
    }
  }
</script>

<section class="builder" bind:this={_editorEl}>
  <h2>Opetope Builder <span class="badge">experimental</span></h2>
  <p class="desc">
    Prev: substrate edge tree. Focus: atomic diagram (right-click leaf box → source extrude; double-click edge in Succ → add drop). Succ: bonded edge tree.
  </p>

  <div class="toolbar">
    <span class="toolbar-label">Examples:</span>
    {#each examples as ex}
      <button class="ex-btn" onclick={() => loadExample(ex.make, ex.name)}>{ex.label}</button>
    {/each}
    <span class="toolbar-sep"></span>
    <button class="rec-btn" class:recording onclick={() => recording ? stopRecording() : startRecording()}>
      {recording ? '⏹ Stop' : '⏺ Record'}
    </button>
  </div>

  <OpetopeEditor onsourceextrude={handleSourceExtrude} ondropinsert={handleDropInsert} onbaredropinsert={handleBareDropInsert} onencircle={handleEncircle} onhopright={handleHopRight} />
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

  .toolbar-sep {
    flex: 1;
  }

  .rec-btn {
    padding: 5px 14px;
    border: 1px solid #bbb;
    border-radius: 20px;
    background: white;
    cursor: pointer;
    font-size: 0.85em;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }

  .rec-btn:hover {
    background: #fce4ec;
    border-color: #c62828;
    color: #c62828;
  }

  .rec-btn.recording {
    background: #ffebee;
    border-color: #c62828;
    color: #c62828;
    font-weight: 700;
    animation: rec-blink 1.2s ease-in-out infinite;
  }

  @keyframes rec-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }
</style>
