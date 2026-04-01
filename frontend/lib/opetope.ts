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
  dim: number      // 0 = point, 1 = arrow, 2 = 2-cell, ...
  nascent?: number // 0 = just born, 1 = fully grown; absent = mature
}

/**
 * Global ID supply — unique across the entire opetope, SVG elements,
 * and force-layout constraint anchors.
 */
let _nextId = 0
export function freshId(): string { return String(_nextId++) }

/**
 * A drop is parasitic on a substrate branch, stored in that branch's Drop[]
 * slot in the children tuple. Its dropId bonds to a lollipop in Succ.
 */
export type Drop = {
  dropId: string   // globally unique primary key
}

/**
 * A disk in the box / edge tree.
 *
 * cell     — the cell at this node (id, label, dim, nascent).
 * away     — Set of substrate branch IDs this disk avoids (complement of support).
 *            support = under(substrate) \ away; always computed, never stored.
 * drops    — drops on THIS node's outgoing branch (the stem for the root; the
 *            branch leading up to the parent for all other nodes). Every node
 *            has exactly one outgoing edge, so drops sit directly on the node.
 * children — [branchId, innerDisk]
 *            null  = open leaf (can be extended via source extrusion)
 *            []    = nullary corolla (lollipop)
 */
export type Tree = {
  cell:     Cell
  away:     Set<string>
  drops:    Drop[]
  children: [string, Tree][] | null
}

/**
 * One "slice" of an opetopic complex.
 *
 * root     = box tree  (the outermost cell, containing others as boxes)
 * edgeRoot = edge tree (the source structure, directed edges between cells)
 *
 * Drops are stored on each Tree node (node.drops = drops on its outgoing branch).
 * Use collectDrops() to derive the flat DropInfo[] needed by the rendering layer.
 */
export type AtomicDiagram = {
  root:     Tree
  edgeRoot: Tree
}

/**
 * Rendering-layer drop record: the edge node where the drop is attached and the
 * lollipop cell in Succ that it bonds to. Derived by collectDrops().
 */
export type DropInfo = { edgeId: string; rootId: string }

/** Collect all drop records from an edge tree, in traversal order. */
export function collectDrops(t: Tree): DropInfo[] {
  const result: DropInfo[] = []
  function traverse(node: Tree) {
    for (const d of node.drops) {
      result.push({ edgeId: node.cell.id, rootId: d.dropId })
    }
    if (node.children) for (const [, child] of node.children) traverse(child)
  }
  traverse(t)
  return result
}

/** An opetope: sequence of n disk trees, one per dimension. */
export type Opetope = Tree[]

/** Compute the set of all branch IDs reachable in a substrate tree. */
export function allBranchIds(t: Tree): Set<string> {
  const ids = new Set<string>()
  function collect(node: Tree) {
    if (!node.children) return
    for (const [id, child] of node.children) {
      ids.add(id); collect(child)
    }
  }
  collect(t)
  return ids
}

/** The support of a disk: the substrate branch IDs it straddles. */
export function support(disk: Tree, substrate: Tree | null): Set<string> {
  const u = substrate ? allBranchIds(substrate) : new Set<string>()
  return new Set([...u].filter(id => !disk.away.has(id)))
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
    if (tree.children) for (const [, subtree] of tree.children) {
      collectNodes(subtree)
    }
  }
  collectNodes(diagram.edgeRoot)

  // ── Step 2: collect edges from edge tree (deduplicated) ──────────────────
  const seenEdges = new Set<string>()
  function collectEdges(tree: Tree) {
    const parentIdx = cellIndex.get(tree.cell.id)!
    if (tree.children) for (const [, subtree] of tree.children) {
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

    if (tree.children) for (const [, subtree] of tree.children) {
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
    if (t.children) for (const [, child] of t.children) collectAll(child)
  }
  function seek(t: Tree): boolean {
    if (t.cell.id === cellId) { collectAll(t); return true }
    if (t.children) for (const [, child] of t.children) { if (seek(child)) return true }
    return false
  }
  seek(tree)
  return ids
}

/** Return the subtree rooted at cellId, or null if not found. */
export function subtreeFor(tree: Tree, cellId: string): Tree | null {
  if (tree.cell.id === cellId) return tree
  if (tree.children) for (const [, child] of tree.children) {
    const found = subtreeFor(child, cellId)
    if (found) return found
  }
  return null
}

/**
 * Source extrusion at a leaf: the leaf becomes a corolla with one new nascent child.
 *
 * The new child cell is shared between root and edgeRoot (same object), so both
 * renderers see the same nascent value — the bond holds during animation.
 */
export function sourceExtrude(tree: Tree, leafId: string, newCell: Cell): Tree {
  if (tree.cell.id === leafId && tree.children === null) {
    return { ...tree, children: [['src', { cell: newCell, away: new Set(), drops: [], children: null }]] }
  }
  if (tree.children === null) return tree
  return {
    ...tree,
    children: tree.children.map(
      ([lbl, child]) => [lbl, sourceExtrude(child, leafId, newCell)] as [string, Tree]
    ),
  }
}

/**
 * Drop insertion — triggered by double-clicking an edgeRoot branch in Focus:
 *   1. Adds newCell as a fresh lollipop (children: []) to focus.root.
 *   2. Records the drop in focus.edgeRoot at the appropriate branch:
 *      - For a child branch (edgeCellId = child.cell.id): stored in that branch's Drop[].
 *      - For the output stem (edgeCellId = root.cell.id): stored in root.stemDrops.
 */
export function dropInsert(diagram: AtomicDiagram, edgeCellId: string, newCell: Cell): AtomicDiagram {
  const lollipop: Tree = { cell: newCell, away: new Set(), drops: [], children: [] }
  const newDrop: Drop = { dropId: newCell.id }

  function addLollipopToRoot(t: Tree): Tree {
    if (t.children === null) return { ...t, children: [[newCell.id, lollipop]] }
    return { ...t, children: [...t.children, [newCell.id, lollipop]] }
  }

  // Add newDrop to whichever node in edgeRoot has cell.id === edgeCellId.
  // That node's outgoing branch is where the drop attaches.
  function addDropToEdgeRoot(t: Tree): Tree {
    if (t.cell.id === edgeCellId) {
      return { ...t, drops: [...t.drops, newDrop] }
    }
    if (!t.children) return t
    return { ...t, children: t.children.map(([bid, child]) => [bid, addDropToEdgeRoot(child)] as [string, Tree]) }
  }

  return {
    ...diagram,
    root:     addLollipopToRoot(diagram.root),
    edgeRoot: addDropToEdgeRoot(diagram.edgeRoot),
  }
}

// ── Example diagrams ─────────────────────────────────────────────────────────

export function cell(label: string, dim: number): Cell { return { id: freshId(), label, dim } }
function leaf(c: Cell): Tree { return { cell: c, away: new Set(), drops: [], children: null } }
function node(c: Cell, children: [string, Tree][]): Tree {
  return { cell: c, away: new Set(), drops: [], children }
}

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
