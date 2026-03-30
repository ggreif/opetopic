/**
 * Core data model for opetopes.
 *
 * An opetopic complex is a sequence of bonded atomic diagrams.
 * Each atomic diagram encodes two trees:
 *   - box tree  (containment, the "from above" view)
 *   - edge tree (connectivity, the "from the side" view)
 *
 * The WebCola graph format (nodes/links/groups/constraints) is the
 * rendering target. `toGraph()` converts an AtomicDiagram to that format.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type Cell = {
  id: string
  label: string
  dim: number   // 0 = point, 1 = arrow, 2 = 2-cell, ...
}

/** A tree node: a cell with labeled child subtrees. */
export type Tree = {
  cell: Cell
  children: [string, Tree][]  // edge label → subtree
}

/**
 * One "slice" of an opetopic complex.
 *
 * root     = box tree  (the outermost cell, containing others as boxes)
 * edgeRoot = edge tree (the source structure, directed edges between cells)
 *
 * For a simplex (2-cell α with three 1-cell boundary f, g, h):
 *   root     = α { f: x, g: y, h: z }   (α is the box containing f, g, h)
 *   edgeRoot = α { f: x→α, g: y→α, h: z→α }
 */
export type AtomicDiagram = {
  root: Tree
  edgeRoot: Tree
}

// WebCola graph format (matches chris.json schema)
export type GraphNode = { name: string; group?: number }
export type GraphLink = { source: number; target: number; value: number }
export type GraphGroup = { leaves: number[]; groups?: number[]; padding?: number }
export type GraphConstraint = { axis: 'x' | 'y'; left: number; right: number; gap: number }

export type Graph = {
  nodes: GraphNode[]
  links: GraphLink[]
  groups: GraphGroup[]
  constraints: GraphConstraint[]
}

// ── toGraph ──────────────────────────────────────────────────────────────────

/**
 * Convert an AtomicDiagram to a WebCola Graph.
 *
 * Strategy:
 *   - Each unique cell in the edge tree becomes a node.
 *   - Each edge tree edge (parent→child) becomes a link + y-constraint.
 *   - Box tree groupings become groups (leaves + nested groups).
 *
 * We use the edge tree for nodes/links/constraints and the box tree
 * for groups, mirroring the chris.json structure.
 */
export function toGraph(diagram: AtomicDiagram): Graph {
  const nodes: GraphNode[] = []
  const links: GraphLink[] = []
  const groups: GraphGroup[] = []
  const constraints: GraphConstraint[] = []

  // ── Step 1: collect all cells from edge tree into nodes ──────────────────
  const cellIndex = new Map<string, number>()  // cell.id → node index

  function collectNodes(tree: Tree) {
    if (!cellIndex.has(tree.cell.id)) {
      cellIndex.set(tree.cell.id, nodes.length)
      nodes.push({ name: tree.cell.label, group: tree.cell.dim })
    }
    for (const [, subtree] of tree.children) {
      collectNodes(subtree)
    }
  }
  collectNodes(diagram.edgeRoot)

  // ── Step 2: collect edges from edge tree (deduplicated) ──────────────────
  const seenEdges = new Set<string>()
  function collectEdges(tree: Tree) {
    const parentIdx = cellIndex.get(tree.cell.id)!
    for (const [, subtree] of tree.children) {
      const childIdx = cellIndex.get(subtree.cell.id)!
      const edgeKey = `${childIdx}->${parentIdx}`
      if (!seenEdges.has(edgeKey)) {
        seenEdges.add(edgeKey)
        links.push({ source: childIdx, target: parentIdx, value: 1 })
        constraints.push({ axis: 'y', left: childIdx, right: parentIdx, gap: 25 })
      }
      collectEdges(subtree)
    }
  }
  collectEdges(diagram.edgeRoot)

  // ── Step 3: box tree → groups (each node in at most one group) ───────────
  const groupedNodes = new Set<number>()
  function collectGroups(tree: Tree): number {
    const leaves: number[] = []
    const childGroupIndices: number[] = []

    const ownIdx = cellIndex.get(tree.cell.id)
    if (ownIdx !== undefined && !groupedNodes.has(ownIdx)) {
      groupedNodes.add(ownIdx)
      leaves.push(ownIdx)
    }

    for (const [, subtree] of tree.children) {
      const childOwnIdx = cellIndex.get(subtree.cell.id)
      // Only recurse into subtrees whose root cell hasn't been grouped yet
      if (childOwnIdx !== undefined && !groupedNodes.has(childOwnIdx)) {
        const gIdx = collectGroups(subtree)
        childGroupIndices.push(gIdx)
      }
    }

    const gIdx = groups.length
    groups.push({
      leaves,
      groups: childGroupIndices.length > 0 ? childGroupIndices : undefined,
      padding: 12,
    })
    return gIdx
  }
  collectGroups(diagram.root)

  return { nodes, links, groups, constraints }
}

// ── Tree utilities ───────────────────────────────────────────────────────────

/** Return the ids of cellId and all its descendants in the tree. Empty if not found. */
export function descendantIds(tree: Tree, cellId: string): Set<string> {
  const ids = new Set<string>()
  function collectAll(t: Tree) {
    ids.add(t.cell.id)
    for (const [, child] of t.children) collectAll(child)
  }
  function seek(t: Tree): boolean {
    if (t.cell.id === cellId) { collectAll(t); return true }
    for (const [, child] of t.children) { if (seek(child)) return true }
    return false
  }
  seek(tree)
  return ids
}

/** Return the subtree rooted at cellId, or null if not found. */
export function subtreeFor(tree: Tree, cellId: string): Tree | null {
  if (tree.cell.id === cellId) return tree
  for (const [, child] of tree.children) {
    const found = subtreeFor(child, cellId)
    if (found) return found
  }
  return null
}

// ── Example diagrams ─────────────────────────────────────────────────────────

let _id = 0
function id(label: string) { return `${label}_${_id++}` }
function cell(label: string, dim: number): Cell { return { id: id(label), label, dim } }
function leaf(c: Cell): Tree { return { cell: c, children: [] } }
function node(c: Cell, children: [string, Tree][]): Tree { return { cell: c, children } }

/**
 * A single 0-cell (point). Just one node, no edges.
 */
export function point(label = 'a'): AtomicDiagram {
  const x = cell(label, 0)
  const t = leaf(x)
  return { root: t, edgeRoot: t }
}

/**
 * A 1-cell: arrow f: a → b.
 * Edge tree: f at top, a and b as children (source/target).
 */
export function arrow(fLabel = 'f', srcLabel = 'a', tgtLabel = 'b'): AtomicDiagram {
  const f = cell(fLabel, 1)
  const x = cell(srcLabel, 0)
  const y = cell(tgtLabel, 0)
  const edgeRoot = node(f, [['src', leaf(x)], ['tgt', leaf(y)]])
  return { root: edgeRoot, edgeRoot }
}

/**
 * A 2-cell simplex α with three 1-cell inputs f, g, h.
 * Each 1-cell has two unique 0-cell endpoints — the Tree type is a tree,
 * not a DAG, so shared vertices are represented as distinct leaves with
 * distinct labels (a…i, skipping the 1-cell labels f, g, h).
 *
 *   α → f (a→b)
 *   α → g (c→d)
 *   α → h (e→i)
 */
export function simplex(
  alphaLabel = 'α',
  fLabel = 'f', gLabel = 'g', hLabel = 'h',
  f_src = 'a', f_tgt = 'b',
  g_src = 'c', g_tgt = 'd',
  h_src = 'e', h_tgt = 'i',
): AtomicDiagram {
  const alpha = cell(alphaLabel, 2)
  const f = cell(fLabel, 1)
  const g = cell(gLabel, 1)
  const h = cell(hLabel, 1)

  const edgeRoot = node(alpha, [
    [fLabel, node(f, [['src', leaf(cell(f_src, 0))], ['tgt', leaf(cell(f_tgt, 0))]])],
    [gLabel, node(g, [['src', leaf(cell(g_src, 0))], ['tgt', leaf(cell(g_tgt, 0))]])],
    [hLabel, node(h, [['src', leaf(cell(h_src, 0))], ['tgt', leaf(cell(h_tgt, 0))]])],
  ])

  return { root: edgeRoot, edgeRoot }
}

/**
 * The boxtree example from boxtree.svg.
 *
 * Box tree (left side of SVG) = nested rectangles:
 *   j { g { a, b, c }, i { t }, u { d, e } }
 *
 * Edge tree (right side of SVG) = rooted tree with same shape:
 *   j → g → { a, b, c }
 *   j → i → { t }
 *   j → u → { d, e }
 *
 * Labels: j = 2-cell (outermost), g/i/u = 1-cells, a/b/c/t/d/e = 0-cells
 */
export function boxtree(): AtomicDiagram {
  const j = cell('j', 2)
  const g = cell('g', 1)
  const i = cell('i', 1)
  const u = cell('u', 1)
  const a = cell('a', 0)
  const b = cell('b', 0)
  const c = cell('c', 0)
  const t = cell('t', 0)
  const d = cell('d', 0)
  const e = cell('e', 0)

  const tree: Tree = node(j, [
    ['g', node(g, [['a', leaf(a)], ['b', leaf(b)], ['c', leaf(c)]])],
    ['i', node(i, [['t', leaf(t)]])],
    ['u', node(u, [['d', leaf(d)], ['e', leaf(e)]])],
  ])

  return { root: tree, edgeRoot: tree }
}
