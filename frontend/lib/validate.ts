/**
 * Opetope diagram validation.
 *
 * validateDiagram(diagram) returns null if the diagram is valid, or a string
 * describing the first violated rule. Call this before every state update.
 *
 * Rules are grouped and ordered cheapest-first (fail-fast).
 * Fundamental rules always run; advisory rules run in all builds but are
 * clearly labelled ADVISORY in their violation strings.
 */

import type { Tree, AtomicDiagram, Cell, Drop } from './opetope'
import { allBranchIds, collectDrops, subtreeFor } from './opetope'

// ── Internal traversal helpers ────────────────────────────────────────────────

function collectAllNodes(t: Tree): Tree[] {
  const result: Tree[] = []
  function walk(n: Tree) {
    result.push(n)
    if (n.children) for (const [, child] of n.children) walk(child)
  }
  walk(t)
  return result
}

function buildCellMap(t: Tree): Map<string, Tree> {
  const m = new Map<string, Tree>()
  function walk(n: Tree) {
    m.set(n.cell.id, n)
    if (n.children) for (const [, child] of n.children) walk(child)
  }
  walk(t)
  return m
}

function buildBranchIdSet(t: Tree): Set<string> {
  const s = new Set<string>()
  function walk(n: Tree) {
    if (n.children) for (const [bid, child] of n.children) { s.add(bid); walk(child) }
  }
  walk(t)
  return s
}

function isAcyclic(t: Tree): boolean {
  const onStack = new Set<string>()
  function dfs(n: Tree): boolean {
    if (onStack.has(n.cell.id)) return false
    onStack.add(n.cell.id)
    if (n.children) for (const [, child] of n.children) {
      if (!dfs(child)) return false
    }
    onStack.delete(n.cell.id)
    return true
  }
  return dfs(t)
}

// ── Main validator ────────────────────────────────────────────────────────────

export function validateDiagram(diagram: AtomicDiagram): string | null {
  const { edgeRoot, root } = diagram

  // ── O(1) checks ────────────────────────────────────────────────────────────

  // 5.2 no-drops-without-root
  if (root === null && collectDrops(edgeRoot).length > 0)
    return 'no-drops-without-root: drops exist but root is null'

  // 6.2 root-dim-is-edgeroot+1
  if (root !== null && root !== edgeRoot && root.cell.dim !== edgeRoot.cell.dim + 1)
    return `root-dim-is-edgeroot+1: root.dim=${root.cell.dim} but edgeRoot.dim=${edgeRoot.cell.dim}`

  // ── Build shared data structures (single O(n) pass each) ───────────────────

  const edgeNodes  = collectAllNodes(edgeRoot)
  const rootNodes  = root ? collectAllNodes(root) : []

  const edgeCellMap = buildCellMap(edgeRoot)
  const rootCellMap = root ? buildCellMap(root) : new Map<string, Tree>()

  const edgeInnerIds = new Set<string>(
    edgeNodes.filter(n => n.children !== null).map(n => n.cell.id)
  )
  const edgeBranchIds = buildBranchIdSet(edgeRoot)

  const allDrops = collectDrops(edgeRoot)

  // ── Structural / uniqueness checks ─────────────────────────────────────────

  // 1.1 acyclic-edgeRoot
  if (!isAcyclic(edgeRoot))
    return 'acyclic-edgeRoot: cycle detected in edgeRoot'

  // 1.2 acyclic-root
  if (root && root !== edgeRoot && !isAcyclic(root))
    return 'acyclic-root: cycle detected in root'

  // 2.1 unique-cell-ids (within each tree)
  {
    const seen = new Map<string, number>()
    for (const n of edgeNodes) seen.set(n.cell.id, (seen.get(n.cell.id) ?? 0) + 1)
    for (const [id, count] of seen) if (count > 1)
      return `unique-cell-ids: cell id "${id}" appears ${count} times in edgeRoot`

    if (root && root !== edgeRoot) {
      const rseen = new Map<string, number>()
      for (const n of rootNodes) rseen.set(n.cell.id, (rseen.get(n.cell.id) ?? 0) + 1)
      for (const [id, count] of rseen) if (count > 1)
        return `unique-cell-ids: cell id "${id}" appears ${count} times in root`
    }
  }

  // 2.2 unique-drop-ids
  {
    const seen = new Set<string>()
    for (const d of allDrops) {
      if (seen.has(d.rootId)) return `unique-drop-ids: dropId "${d.rootId}" is duplicated`
      seen.add(d.rootId)
    }
  }

  // 1.3 edgeroot-no-lollipop (ADVISORY)
  for (const n of edgeNodes) {
    if (n.children !== null && n.children.length === 0)
      return `ADVISORY edgeroot-no-lollipop: node "${n.cell.label}" (id=${n.cell.id}) is a lollipop in edgeRoot`
  }

  // 1.4/8.2 branch-ids-unique-within-node
  for (const n of edgeNodes) {
    if (!n.children) continue
    const bids = n.children.map(([bid]) => bid)
    if (new Set(bids).size !== bids.length)
      return `branch-ids-unique-within-node: duplicate branch IDs under edge node "${n.cell.label}"`
  }
  if (root) for (const n of rootNodes) {
    if (!n.children) continue
    const bids = n.children.map(([bid]) => bid)
    if (new Set(bids).size !== bids.length)
      return `branch-ids-unique-within-node: duplicate branch IDs under root node "${n.cell.label}"`
  }

  // 8.1 branch-ids-globally-unique across ALL trees
  {
    const seen = new Set<string>()
    function checkBranches(n: Tree, treeName: string): string | null {
      if (!n.children) return null
      for (const [bid, child] of n.children) {
        if (seen.has(bid)) return `branch-ids-globally-unique: branch id "${bid}" already seen (duplicate in or across ${treeName})`
        seen.add(bid)
        const r: string | null = checkBranches(child, treeName)
        if (r) return r
      }
      return null
    }
    const r1 = checkBranches(edgeRoot, 'edgeRoot')
    if (r1) return r1
    if (root && root !== edgeRoot) {
      const r2 = checkBranches(root, 'root')
      if (r2) return r2
    }
  }

  // 8.3 drop-branch-ids-distinct within each node
  for (const n of edgeNodes) {
    const seen = new Set<string>()
    for (const d of n.drops) {
      if (seen.has(d.dropId)) return `drop-branch-ids-distinct: dropId "${d.dropId}" appears twice on node "${n.cell.label}"`
      seen.add(d.dropId)
    }
  }

  // ── Dimension checks ───────────────────────────────────────────────────────

  // 6.4 dim-non-negative
  for (const n of edgeNodes) if (n.cell.dim < 0)
    return `dim-non-negative: cell "${n.cell.label}" has dim=${n.cell.dim} in edgeRoot`
  for (const n of rootNodes) if (n.cell.dim < 0)
    return `dim-non-negative: cell "${n.cell.label}" has dim=${n.cell.dim} in root`

  // 6.1 edgeroot-dim-decreases
  function checkDims(n: Tree): string | null {
    if (!n.children) return null
    for (const [, child] of n.children) {
      if (n.cell.dim > 0 && child.cell.dim !== n.cell.dim - 1)
        return `edgeroot-dim-decreases: child "${child.cell.label}" dim=${child.cell.dim} but parent "${n.cell.label}" dim=${n.cell.dim}`
      const r = checkDims(child)
      if (r) return r
    }
    return null
  }
  const dimViolation = checkDims(edgeRoot)
  if (dimViolation) return dimViolation

  // 6.3 lollipop-dim-is-zero (in root)
  if (root) for (const n of rootNodes) {
    if (n.children !== null && n.children.length === 0 && n.cell.dim !== 0)
      return `lollipop-dim-is-zero: lollipop "${n.cell.label}" has dim=${n.cell.dim}, expected 0`
  }

  // ── away set checks ────────────────────────────────────────────────────────

  // 4.1 away-branch-ids-exist
  if (root) for (const n of rootNodes) {
    for (const bid of n.away) {
      if (!edgeBranchIds.has(bid))
        return `away-branch-ids-exist: node "${n.cell.label}" has away id "${bid}" not in edgeRoot branches`
    }
  }

  // 4.2 away-not-in-own-children
  if (root) for (const n of rootNodes) {
    if (!n.children) continue
    const ownBids = new Set(n.children.map(([bid]) => bid))
    for (const bid of n.away) {
      if (ownBids.has(bid))
        return `away-not-in-own-children: node "${n.cell.label}" has "${bid}" in both away and own children`
    }
  }

  // ── Drop validity ──────────────────────────────────────────────────────────

  if (root && root !== edgeRoot) {
    // 5.1 drop-id-bonds-to-lollipop
    // dropId is an edge (branch) ID in root — the (n+1)-dimensional tree.
    // In the current encoding dropId === lollipop cell.id === its branch key in its parent,
    // so we check both: the branch exists in root AND it resolves to a lollipop cell.
    const rootBranchIds = buildBranchIdSet(root)
    for (const d of allDrops) {
      if (!rootBranchIds.has(d.rootId))
        return `drop-id-bonds-to-lollipop: dropId "${d.rootId}" is not a branch id in root`
      const sub = rootCellMap.get(d.rootId)
      if (!sub)
        return `drop-id-bonds-to-lollipop: dropId "${d.rootId}" branch exists but cell not found in root`
      if (sub.children === null)
        return `drop-id-bonds-to-lollipop: dropId "${d.rootId}" bonds to an open leaf, not a lollipop`
      if (sub.children.length > 0)
        return `drop-id-bonds-to-lollipop: dropId "${d.rootId}" bonds to an inner node, not a lollipop`
    }

    // 5.3 lollipop-has-drop (ADVISORY for zero-reference; fundamental for double-reference)
    {
      const lollipopIds = new Set(rootNodes.filter(n => n.children !== null && n.children.length === 0).map(n => n.cell.id))
      const dropRefCount = new Map<string, number>()
      for (const d of allDrops) dropRefCount.set(d.rootId, (dropRefCount.get(d.rootId) ?? 0) + 1)
      for (const [id, count] of dropRefCount) if (count > 1)
        return `lollipop-has-drop: lollipop "${rootCellMap.get(id)?.cell.label ?? id}" referenced by ${count} drops`
      for (const id of lollipopIds) if (!dropRefCount.has(id))
        return `ADVISORY lollipop-has-drop: lollipop "${rootCellMap.get(id)?.cell.label ?? id}" has no corresponding drop`
    }
  }

  // ── root ↔ edgeRoot correspondence ─────────────────────────────────────────

  if (root && root !== edgeRoot) {
    // 7.1 root-leaves-correspond-to-edgeroot-inners
    for (const n of rootNodes) {
      if (n.children === null) {  // open leaf in root
        if (!edgeInnerIds.has(n.cell.id))
          return `root-leaves-in-edgeroot-inners: root leaf "${n.cell.label}" (id=${n.cell.id}) is not an inner node of edgeRoot`
      }
    }

    // 7.2 edgeroot-inners-covered-by-root-leaves (ADVISORY)
    {
      const rootLeafIds = new Set(rootNodes.filter(n => n.children === null).map(n => n.cell.id))
      for (const id of edgeInnerIds) {
        if (!rootLeafIds.has(id)) {
          const cell = edgeCellMap.get(id)!.cell
          return `ADVISORY edgeroot-inners-in-root-leaves: edgeRoot inner "${cell.label}" (id=${id}) has no leaf box in root`
        }
      }
    }
  }

  // 3.1 unique-labels-within-edgeRoot
  {
    const seen = new Map<string, string>()  // label → cell id
    for (const n of edgeNodes) {
      if (seen.has(n.cell.label) && seen.get(n.cell.label) !== n.cell.id)
        return `unique-labels: label "${n.cell.label}" used by multiple cells in edgeRoot`
      seen.set(n.cell.label, n.cell.id)
    }
  }

  // 3.2 unique-labels-across-trees: labels in root (displayed in Succ) must not
  //     duplicate labels in edgeRoot (displayed in Focus/Prev), even for shared cell objects.
  if (root && root !== edgeRoot) {
    const edgeLabels = new Set(edgeNodes.map(n => n.cell.label))
    for (const n of rootNodes) {
      if (edgeLabels.has(n.cell.label))
        return `unique-labels-across-trees: label "${n.cell.label}" appears in both edgeRoot (Focus) and root (Succ)`
    }
  }

  // 3.2 no-id-namespace-collision: cell IDs and branch IDs occupy the same global freshId() space,
  //     so no branch ID may equal any cell ID anywhere across all trees.
  //     Violation example: withOuterFrame uses c.id as branch key in root, colliding with
  //     the same c.id as a cell ID in edgeRoot.
  {
    const allCellIds = new Set([
      ...edgeNodes.map(n => n.cell.id),
      ...rootNodes.map(n => n.cell.id),
    ])
    const allBranchIdsEdge = buildBranchIdSet(edgeRoot)
    const allBranchIdsRoot = root && root !== edgeRoot ? buildBranchIdSet(root) : new Set<string>()
    for (const bid of allBranchIdsEdge) {
      if (allCellIds.has(bid))
        return `no-id-namespace-collision: branch id "${bid}" in edgeRoot equals a cell id`
    }
    for (const bid of allBranchIdsRoot) {
      if (allCellIds.has(bid))
        return `no-id-namespace-collision: branch id "${bid}" in root equals a cell id`
    }
  }

  return null  // all checks passed
}
