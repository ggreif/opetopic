/**
 * Tape EDSL — a fluent sequence of opetopic combinator operations.
 *
 * Each step drives both the data model and (optionally) the rendered DOM.
 * Steps are serialisable to/from JSON and parseable from `[EDSL] {...}` console lines.
 *
 * Usage:
 *   const tape = new Tape().start('boxtree').extrude('a').drop('a').hop(1)
 *   render(AtomicDiagramView, { props: { diagram: tape.focus, drops: collectDrops(tape.focus.edgeRoot) } })
 */

import {
  cell, freshId, subtreeFor, sourceExtrude, dropInsert, encircleMulti, computeSucc,
  type AtomicDiagram, type Tree, type Cell,
  point, boxtree, simplex, ypsilon, type Opetope,
} from './opetope'
import { validateStack } from './validate'

// ── Step types ───────────────────────────────────────────────────────────────

export type TapeStep =
  | { op: 'start';    example: 'point' | 'boxtree' | 'simplex' | 'ypsilon' }
  | { op: 'extrude';  label: string }
  | { op: 'drop';     label: string }
  | { op: 'hop';      delta: 1 | -1 }
  | { op: 'encircle'; labels: string[] }

// ── withOuterFrame (copied from OpetopeBuilder to keep Tape self-contained) ──

const _greek = ['α','β','γ','δ','ε','ζ','η','θ','ι','κ','λ','μ','ν','ξ','ο','π']
let _labelIdx = 0
function freshLabel(): string {
  const i = _labelIdx++
  return i < _greek.length ? _greek[i] : `x${i - _greek.length}`
}

function withOuterFrame(diagram: AtomicDiagram): AtomicDiagram {
  const innerNodes: Cell[] = []
  function collectInner(t: Tree) {
    if (t.children !== null && t.children.length > 0) {
      innerNodes.push(t.cell)
      for (const [, child] of t.children) collectInner(child)
    }
  }
  collectInner(diagram.edgeRoot)
  if (innerNodes.length === 0) return { edgeRoot: diagram.edgeRoot, root: null }

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
    [freshId(), { cell: { ...c, label: safeLabel() }, away: new Set(), drops: [], children: null } as Tree]
  )
  return { edgeRoot: diagram.edgeRoot, root: { cell: frameCell, away: new Set(), drops: [], children } }
}

// ── Tape class ───────────────────────────────────────────────────────────────

export class Tape {
  steps: TapeStep[] = []
  diagrams: AtomicDiagram[] = []
  focusIdx: number = 0

  // ── Accessors ──────────────────────────────────────────────────────────────

  get focus(): AtomicDiagram {
    return this.diagrams[this.focusIdx]
  }

  /** Map lollipop cell label → branch ID in focus.root */
  lolliToBranchId(label: string): string | undefined {
    const root = this.focus.root
    if (!root) return undefined
    function walk(t: Tree): string | undefined {
      if (!t.children) return undefined
      for (const [bid, child] of t.children) {
        if (child.children !== null && child.children.length === 0 && child.cell.label === label) return bid
        const found = walk(child)
        if (found !== undefined) return found
      }
      return undefined
    }
    return walk(root)
  }

  // ── Fluent builder ─────────────────────────────────────────────────────────

  start(example: 'point' | 'boxtree' | 'simplex' | 'ypsilon'): this {
    this.steps.push({ op: 'start', example })
    const makers: Record<string, () => Opetope> = { point, boxtree, simplex, ypsilon }
    const trees = makers[example]()
    if (trees.length === 1) {
      this.diagrams = [withOuterFrame({ edgeRoot: trees[0], root: null })]
      this.focusIdx = 0
      return this
    }
    const diagrams: AtomicDiagram[] = trees.slice(0, -1).map((t, i) => ({ edgeRoot: t, root: trees[i + 1] }))
    diagrams.push(withOuterFrame({ edgeRoot: trees[trees.length - 1], root: null }))
    this.diagrams = diagrams
    this.focusIdx = 0
    return this
  }

  extrude(label: string): this {
    this.steps.push({ op: 'extrude', label })
    const focus = this.focus
    // Find the leaf in edgeRoot with matching label
    function findLeaf(t: Tree): Tree | null {
      if (t.cell.label === label && t.children === null) return t
      if (t.children) for (const [, child] of t.children) {
        const found = findLeaf(child)
        if (found) return found
      }
      return null
    }
    const leaf = findLeaf(focus.edgeRoot)
    if (!leaf) throw new Error(`extrude: no leaf with label '${label}'`)

    const newCell = cell(freshLabel(), Math.max(0, leaf.cell.dim - 1))
    const newEdgeRoot = sourceExtrude(focus.edgeRoot, leaf.cell.id, newCell)
    const newlyInnerCell = subtreeFor(newEdgeRoot, leaf.cell.id)!.cell
    const newLeafBox: Tree = { cell: { ...newlyInnerCell, label: freshLabel() }, away: new Set(), drops: [], children: null }

    const oldRoot = focus.root
    let newRoot: Tree
    if (!oldRoot) {
      const frameCell = cell(freshLabel(), newlyInnerCell.dim + 1)
      newRoot = { cell: frameCell, away: new Set(), drops: [], children: [[freshId(), newLeafBox]] }
    } else if (oldRoot.children === null) {
      newRoot = { ...oldRoot, children: [[freshId(), newLeafBox]] }
    } else {
      newRoot = { ...oldRoot, children: [...oldRoot.children, [freshId(), newLeafBox]] }
    }
    this.diagrams[this.focusIdx] = { edgeRoot: newEdgeRoot, root: newRoot }
    return this
  }

  drop(label: string): this {
    this.steps.push({ op: 'drop', label })
    const focus = this.focus
    // Find node in edgeRoot with matching label
    function findNode(t: Tree): Tree | null {
      if (t.cell.label === label) return t
      if (t.children) for (const [, child] of t.children) {
        const found = findNode(child)
        if (found) return found
      }
      return null
    }
    const node = findNode(focus.edgeRoot)
    if (!node) throw new Error(`drop: no node with label '${label}'`)

    const newCell = cell(freshLabel(), 0)
    const branchId = freshId()
    const newFocus = dropInsert(focus, node.cell.id, newCell, branchId)
    if (newFocus.root) {
      this.diagrams[this.focusIdx] = newFocus
    } else {
      const frameCell = cell(freshLabel(), newFocus.edgeRoot.cell.dim + 1)
      const lollipop: Tree = { cell: newCell, away: new Set(), drops: [], children: [] }
      this.diagrams[this.focusIdx] = {
        ...newFocus,
        root: { cell: frameCell, away: new Set(), drops: [], children: [[branchId, lollipop]] }
      }
    }
    return this
  }

  hop(delta: 1 | -1): this {
    this.steps.push({ op: 'hop', delta })
    if (delta === 1) {
      const focus = this.focus
      if (!focus.root) return this
      const succDiagram = this.diagrams[this.focusIdx + 1]
      if (!succDiagram) {
        // hop right into new level: computeSucc becomes the new edgeRoot
        const newEdgeRoot = computeSucc(focus.root)
        this.diagrams.push(withOuterFrame({ edgeRoot: newEdgeRoot, root: null }))
      }
      this.focusIdx++
    } else {
      if (this.focusIdx > 0) this.focusIdx--
    }
    return this
  }

  encircle(labels: string[]): this {
    this.steps.push({ op: 'encircle', labels })
    const focus = this.focus
    if (!focus.root || labels.length === 0) return this
    function findByLabel(t: Tree, lbl: string): string | null {
      if (t.cell.label === lbl) return t.cell.id
      if (t.children) for (const [, child] of t.children) {
        const found = findByLabel(child, lbl)
        if (found) return found
      }
      return null
    }
    const cellIds = new Set<string>()
    for (const label of labels) {
      const id = findByLabel(focus.edgeRoot, label)
      if (!id) throw new Error(`encircle: no node with label '${label}'`)
      cellIds.add(id)
    }
    const anyId = [...cellIds][0]
    const sub = subtreeFor(focus.edgeRoot, anyId)
    if (!sub) return this
    const next = encircleMulti(focus, cellIds, cell(freshLabel(), sub.cell.dim + 1))
    if (next !== focus) this.diagrams[this.focusIdx] = next
    return this
  }

  // ── Validation guard ───────────────────────────────────────────────────────

  validate(): string | null {
    return validateStack(this.diagrams) ?? null
  }

  // ── Serialisation ──────────────────────────────────────────────────────────

  toJSON(): TapeStep[] {
    return this.steps
  }

  static fromJSON(steps: TapeStep[]): Tape {
    const tape = new Tape()
    for (const step of steps) {
      switch (step.op) {
        case 'start':    tape.start(step.example); break
        case 'extrude':  tape.extrude(step.label); break
        case 'drop':     tape.drop(step.label); break
        case 'hop':      tape.hop(step.delta); break
        case 'encircle': tape.encircle(step.labels); break
      }
    }
    return tape
  }

  /** Parse `[EDSL] {...}` lines from DevTools console output. */
  static fromLog(lines: string[]): Tape {
    const steps: TapeStep[] = []
    for (const line of lines) {
      const m = line.match(/\[EDSL\]\s+(\{.*\})/)
      if (m) {
        try { steps.push(JSON.parse(m[1]) as TapeStep) } catch { /* skip malformed */ }
      }
    }
    return Tape.fromJSON(steps)
  }
}
