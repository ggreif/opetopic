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
export function resetIds(): void { _nextId = 0 }

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
 *            Drop[]  = ordinary drops (array, possibly empty).
 *            Drop    = singular form: marks this node as a bare-drop stem in
 *                      focus.root. The dropId bonds to the Succ lollipop branch
 *                      (dim 2), just like ordinary drops. A bare-drop stem must
 *                      satisfy: children === null, cell.dim === 1, away empty.
 * children — [branchId, innerDisk]
 *            null  = open leaf (can be extended via source extrusion)
 *            []    = nullary corolla (lollipop)
 */
export type Tree = {
  cell:     Cell
  away:     Set<string>
  drops:    Drop | Drop[]
  children: [string, Tree][] | null
}

/** True when a Tree node is a bare-drop stem (singular Drop in focus.root). */
export function isBareDrop(node: Tree): node is Tree & { drops: Drop } {
  return !Array.isArray(node.drops)
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
  root:     Tree | null  // null when substrate has no inner nodes (e.g. Point)
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
    if (Array.isArray(node.drops)) {
      for (const d of node.drops) {
        result.push({ edgeId: node.cell.id, rootId: d.dropId })
      }
    }
    // singular Drop = bare-drop stem in focus.root; not included in ordinary DropInfo[]
    if (node.children) for (const [, child] of node.children) traverse(child)
  }
  traverse(t)
  return result
}

/**
 * Compute the Succ edge tree from focus.root (the box tree).
 * Bond bijection: each box → a node, box nesting → branch structure.
 * Leaf boxes → leaf nodes (open input branches); outer frame → root (output stem).
 */
export function computeSucc(root: Tree): Tree {
  if (root.children === null) {
    return { cell: root.cell, away: new Set(), drops: [], children: null }  // open branch
  }
  if (root.children.length === 0) {
    return { cell: root.cell, away: new Set(), drops: [], children: [] }    // lollipop (nullary corolla)
  }
  return {
    cell: root.cell,
    away: new Set(),
    drops: [],
    children: root.children.map(([branchId, child]) => [branchId, computeSucc(child)] as [string, Tree])
  }
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
  if (diagram.root) collectGroups(diagram.root)

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
    return { ...tree, children: [[freshId(), { cell: newCell, away: new Set(), drops: [], children: null }]] }
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
export function dropInsert(diagram: AtomicDiagram, edgeCellId: string, newCell: Cell, branchId = freshId()): AtomicDiagram {
  // branchId: branch key in root AND dropId — always separate from any cell id
  const lollipop: Tree = { cell: newCell, away: new Set(), drops: [], children: [] }
  const newDrop: Drop = { dropId: branchId }

  function addLollipopToRoot(t: Tree, isRoot: boolean): Tree {
    if (!isRoot) return t  // only add to the root node (outer frame)
    if (t.children === null) return { ...t, children: [[branchId, lollipop]] }
    return { ...t, children: [...t.children, [branchId, lollipop]] }
  }

  // Add newDrop to whichever node in edgeRoot has cell.id === edgeCellId.
  // That node's outgoing branch is where the drop attaches.
  function addDropToEdgeRoot(t: Tree): Tree {
    if (t.cell.id === edgeCellId) {
      const existing = Array.isArray(t.drops) ? t.drops : [t.drops]
      return { ...t, drops: [...existing, newDrop] }
    }
    if (!t.children) return t
    return { ...t, children: t.children.map(([bid, child]) => [bid, addDropToEdgeRoot(child)] as [string, Tree]) }
  }

  return {
    ...diagram,
    root:     diagram.root ? addLollipopToRoot(diagram.root, true) : null,
    edgeRoot: addDropToEdgeRoot(diagram.edgeRoot),
  }
}

// ── Multi-selection helpers ───────────────────────────────────────────────────

/** Build a map of childCellId → parentCellId for the entire edge tree. */
export function parentMap(tree: Tree): Map<string, string> {
  const m = new Map<string, string>()
  function walk(t: Tree) {
    if (t.children) for (const [, child] of t.children) {
      m.set(child.cell.id, t.cell.id)
      walk(child)
    }
  }
  walk(tree)
  return m
}

/**
 * Compute the minimal connected subtree of edgeRoot that contains all ids.
 * Finds the LCA of all ids and includes every node on the path from LCA to each id.
 */
export function minConnectedSubtree(edgeRoot: Tree, ids: Set<string>): Set<string> {
  if (ids.size === 0) return new Set()
  const parents = parentMap(edgeRoot)

  function chain(id: string): string[] {
    const result: string[] = []
    let cur: string | undefined = id
    while (cur !== undefined) { result.push(cur); cur = parents.get(cur) }
    return result
  }

  const chains = new Map([...ids].map(id => [id, chain(id)]))

  // LCA = deepest node appearing in all chains
  const firstChain = chains.values().next().value as string[]
  let lca = firstChain[firstChain.length - 1]  // fallback: root
  for (const node of firstChain) {
    if ([...chains.values()].every(c => c.includes(node))) { lca = node; break }
  }

  // Include every node on path from lca down to each selected node
  const result = new Set<string>()
  for (const id of ids) {
    let cur: string | undefined = id
    while (cur !== undefined && cur !== lca) { result.add(cur); cur = parents.get(cur) }
    result.add(lca)
  }
  return result
}

/**
 * Check whether ids forms a valid encircleable set:
 * - non-empty, no id is the edge root
 * - exactly one node whose parent is not in ids (= the subtree root)
 */
export function isValidEncircleSet(edgeRoot: Tree, ids: Set<string>): boolean {
  if (ids.size === 0) return false
  const parents = parentMap(edgeRoot)
  const externalParentCount = [...ids].filter(id => !ids.has(parents.get(id)!)).length
  return externalParentCount === 1
}

/**
 * Encircle — wraps a new outer disk around the connected subtree defined by cellIds.
 *
 * The subtree root (the unique node in cellIds whose parent is not in cellIds)
 * gets wrapped. For a single-node set this is identical to the old `encircle`.
 * Only `root` changes; `edgeRoot` is returned as-is.
 */
export function encircleMulti(diagram: AtomicDiagram, cellIds: Set<string>, newCell: Cell): AtomicDiagram {
  if (!diagram.root || cellIds.size === 0) return diagram
  const parents = parentMap(diagram.edgeRoot)
  const subtreeRootId = [...cellIds].find(id => !cellIds.has(parents.get(id)!))
  if (!subtreeRootId || diagram.root.cell.id === subtreeRootId) return diagram

  function walk(t: Tree): Tree {
    if (!t.children) return t
    // Separate selected leaf-box children from others; lollipops always stay outside.
    const selectedChildren: [string, Tree][] = []
    const otherChildren: [string, Tree][] = []
    for (const [branchId, child] of t.children) {
      if (cellIds.has(child.cell.id)) {
        selectedChildren.push([branchId, { ...child, away: new Set() }])
      } else {
        otherChildren.push([branchId, walk(child)])
      }
    }
    if (selectedChildren.length === 0) return { ...t, children: otherChildren }
    // Wrapper gets a fresh branch ID — reusing a selectedChild's branch ID would
    // create a duplicate (same ID in both the parent and inside the wrapper).
    const wrapper: Tree = {
      cell:     newCell,
      away:     new Set(),
      drops:    [],
      children: selectedChildren,
    }
    return { ...t, children: [...otherChildren, [freshId(), wrapper]] }
  }

  return { ...diagram, root: walk(diagram.root) }
}

/** Single-node encircle — delegates to encircleMulti. */
export function encircle(diagram: AtomicDiagram, cellId: string, newCell: Cell): AtomicDiagram {
  return encircleMulti(diagram, new Set([cellId]), newCell)
}

// ── Example diagrams ─────────────────────────────────────────────────────────

export function cell(label: string, dim: number): Cell { return { id: freshId(), label, dim } }
function leaf(c: Cell, drops: Drop | Drop[] = []): Tree { return { cell: c, away: new Set(), drops, children: null } }
function lollipop(c: Cell): Tree { return { cell: c, away: new Set(), drops: [], children: [] } }
function drop(branchId: string): Drop { return { dropId: branchId } }
export function substrate(label: string, c: Cell): Cell { return { ...c, label } }
function node(c: Cell, children: [string, Tree][]): Tree {
  return { cell: c, away: new Set(), drops: [], children }
}

/**
 * A single 0-cell (point). Just one node, no edges.
 */
export function point(label = 'a'): Opetope {
  const x = cell(label, 0)
  return [leaf(x)]
}

/**
 * A bare drop: a dim-0 point with a bare-drop stem in the outer frame.
 * diagrams[0].edgeRoot = leaf(a)     — the single 0-cell input
 * diagrams[0].root     = frame f     — outer frame (dim 1) containing the bare-drop stem α
 * α is a bare-drop stem: open (children: null), dim 1, singular Drop bonding to Succ's lollipop.
 */
export function bareDrop(pointLabel = 'a', dropLabel = 'f'): Opetope {
  const a         = cell(pointLabel, 0)
  const f         = cell(dropLabel, 1)
  const l         = cell(dropLabel,  2)
  const lolliId   = l.id  // branch ID of the lollipop in diagrams[1].root (Succ), bonding left to the bare drop
  const dim0: Tree = leaf(a)

  // Bare-drop stem: open, dim 1, singular Drop → bonds to Succ's lollipop
  //const dim1: Tree = { cell: f, away: new Set(), drops: drop(lolliId), children: null }
  const dim1: Tree = leaf(f, drop(lolliId))

  // The non-child lolli that bonds to the bare drop
  const dim2: Tree = lollipop(l)

  return [dim0, dim1, dim2]
}

/**
 * A 2-cell: an Y.
 * Edge tree: f is output, a and b inputs (source/target).
 */
export function ypsilon(fLabel = 'f', srcLabel = 'a', tgtLabel = 'b'): Opetope {
  const f = cell(fLabel, 1)
  const points = ['0','1','2'].map(l => cell(l, 0))
  const x = substrate(srcLabel, points[0])
  const y = substrate(tgtLabel, points[1])

  // dim0: just a tower of points
  const dim0 = node(points[0], [[freshId(), node(points[1], [[freshId(), leaf(points[2])]])]])

  // dim1: f base, x y substrate (open leaves x,y match inner nodes of dim0)
  const dim1 = node(f, [[freshId(), leaf(x)], [freshId(), leaf(y)]])
  
  // dim2: The space between pasting diagram upper edges `a` and `b`
  //       and the morphism composite `f`
  const dim2 = node(cell('Φ', 2), [[freshId(), leaf(substrate('Y', f))]])
  return [dim0, dim1, dim2]
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
  outLabel = 'out',
): Opetope {
  const alpha = cell(alphaLabel, 2)
  const f = cell(fLabel, 1)
  const g = cell(gLabel, 1)
  const h = cell(hLabel, 1)

  // dim0: chain of 7 points (all inner except last which is an open leaf)
  const [pa, pb, pc, pd, pe, pi, pj] = ['0','1','2','3','4','5','6'].map(l => cell(l, 0))
  const dim0 = node(pa, [[freshId(), node(pb, [[freshId(), node(pc, [[freshId(), node(pd, [[freshId(), node(pe, [[freshId(), node(pi, [[freshId(), leaf(pj)]])]])]])]])]])]])

  // dim1: f,g,h as inner nodes; output 1-cell as root; 0-cells as substrate leaves
  const out = cell(outLabel, 1)
  const dim1 = node(out, [
    [freshId(), node(f, [[freshId(), leaf(substrate(f_src, pa))], [freshId(), leaf(substrate(f_tgt, pb))]])],
    [freshId(), node(g, [[freshId(), leaf(substrate(g_src, pc))], [freshId(), leaf(substrate(g_tgt, pd))]])],
    [freshId(), node(h, [[freshId(), leaf(substrate(h_src, pe))], [freshId(), leaf(substrate(h_tgt, pi))]])],
  ])

  // dim2: alpha with f,g,h,out as substrate leaves
  const dim2 = node(alpha, [
    [freshId(), leaf(substrate(fLabel + '□', f))],
    [freshId(), leaf(substrate(gLabel + '□', g))],
    [freshId(), leaf(substrate(hLabel + '□', h))],
    [freshId(), leaf(substrate(outLabel + '□', out))],
  ])

  return [dim0, dim1, dim2]
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
export function boxtree(): Opetope {
  const j = cell('j', 2)
  const g = cell('g', 1)
  const i = cell('i', 1)
  const u = cell('u', 1)
  const out = cell('⍵', 1)  // output 1-cell: root of dim1
  const [pa, pb, pc, pt, pd, pe, pf] = ['0','1','2','3','4','5','6'].map(l => cell(l, 0))

  // dim0: chain of 7 points (inner except last open leaf)
  const dim0 = node(pa, [[freshId(), node(pb, [[freshId(), node(pc, [[freshId(), node(pt, [[freshId(), node(pd, [[freshId(), node(pe, [[freshId(), leaf(pf)]])]])]])]])]])]])

  // dim1: g, i, u as inner nodes; out (dim=1) as root; 0-cells as substrate leaves
  const dim1 = node(out, [
    [freshId(), node(g, [[freshId(), leaf(substrate('a', pa))], [freshId(), leaf(substrate('b', pb))], [freshId(), leaf(substrate('c', pc))]])],
    [freshId(), node(i, [[freshId(), leaf(substrate('t', pt))]])],
    [freshId(), node(u, [[freshId(), leaf(substrate('d', pd))], [freshId(), leaf(substrate('e', pe))]])],
  ])

  const out2 = cell('J', 2) // output 2-cell: root of dim2
  // dim2: j (dim=2) as root; g, i, u, out as substrate leaves
  const dim2 = node(out2, [
    [freshId(), leaf(substrate('g□', g))],
    [freshId(), leaf(substrate('i□', i))],
    [freshId(), leaf(substrate('u□', u))],
    [freshId(), leaf(substrate('⍵□', out))],
  ])

  return [dim0, dim1, dim2]
}
