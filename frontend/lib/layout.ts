/**
 * Pure layout functions for edge trees.
 *
 * Extracted from AtomicDiagramView.svelte so they can be shared with
 * TreeDiagram.svelte and tested independently. No Svelte dependencies.
 *
 * Migration plan (layouting.md skill):
 *   Step 1 — extraction (done)
 *   Steps 2+3+4 — measureMinSpans + VPSC x-pass (this file)
 *   Steps 5–7 — intermediateBoxes inside computeLayout, TreeDiagram, y-VPSC
 */

import * as d3 from 'd3'
import { Solver, Variable, Constraint } from 'webcola'
import type { Tree } from './opetope'

// ── Layout constants ─────────────────────────────────────────────────────────

export const PAD         = 28
export const ARC_R       = 6
export const TREE_H      = 88
export const DROP_BOX_H  = 16
export const DROP_SPACER = 4
export const DROP_UNIT   = DROP_BOX_H + DROP_SPACER  // 20
export const NODE_W      = DROP_BOX_H                // 16 — width of a tree-node roundrect
export const H_GAP       = 20                        // minimum horizontal gap between siblings
export const INTER_PAD   = 10                        // padding inside each intermediate box

// ── Hierarchy builder ────────────────────────────────────────────────────────

export function buildHier(t: Tree): any {
  return {
    id:       t.cell.id,
    label:    t.cell.label,
    dim:      t.cell.dim,
    nascent:  t.cell.nascent,
    nullary:  t.children !== null && t.children.length === 0,
    children: t.children !== null && t.children.length > 0
      ? t.children.map(([, s]) => buildHier(s))
      : undefined,
  }
}

// ── Step 2: measureMinSpans ───────────────────────────────────────────────────
//
// Walk focus.root (box tree) bottom-up. For each non-root, non-leaf,
// non-lollipop node (an intermediate box), compute the minimum horizontal
// span needed to contain its direct children with INTER_PAD on each side.
//
// Returns Map<cellId, minSpan>. Leaves and lollipops are not in the map;
// callers treat absent entries as NODE_W.

export function measureMinSpans(boxRoot: Tree | null): Map<string, number> {
  const spans = new Map<string, number>()
  if (!boxRoot) return spans

  function walk(t: Tree): number {
    // leaf or lollipop — minimum width is one node
    if (!t.children || t.children.length === 0) return NODE_W
    // recurse first (post-order)
    const childSpans = t.children.map(([, c]) => walk(c))
    const minSpan = childSpans.reduce((sum, s) => sum + s, 0)
      + (childSpans.length - 1) * H_GAP
      + 2 * INTER_PAD
    spans.set(t.cell.id, minSpan)
    return minSpan
  }

  walk(boxRoot)
  return spans
}

// ── measureDropOffsets ───────────────────────────────────────────────────────
//
// For each drop lollipop (nullary node in the box tree), compute how far below
// the owner node's centre the drop rect should start:
//
//   yOffset(drop) = max(NODE_W/2, ownerHH) + DROP_SPACER
//                   + nestingDepthOfDrop * INTER_PAD
//
// ownerHH = hh of the outermost intermediate box wrapping the owner edge-tree
//           node (0 if the owner is unwrapped).
// This ensures that a drop placed on a branch below a towered node starts
// below the tower bottom, not inside it.
// The nestingDepthOfDrop term pushes the drop further down for each encircling
// of the drop itself, keeping the encircling box top above the node bottom.

export function measureDropOffsets(boxRoot: Tree | null, edgeRoot: Tree | null = null): Map<string, number> {
  const result = new Map<string, number>()  // dropRootId → yOffset
  if (!boxRoot) return result

  // Build dropId → ownerCellId from edge tree
  const dropOwner = new Map<string, string>()
  if (edgeRoot) {
    function collectDropOwners(t: Tree) {
      if (Array.isArray(t.drops)) for (const d of t.drops) dropOwner.set(d.dropId, t.cell.id)
      if (t.children) for (const [, c] of t.children) collectDropOwners(c)
    }
    collectDropOwners(edgeRoot)
  }

  // Build nodeHH: outermost wrapper hh for each edge-tree node (0 = unwrapped).
  // Post-order walk of box tree; each intermediate box stamps its hh onto all
  // edge-tree nodes it covers (taking the max across nesting levels).
  const nodeHH = new Map<string, number>()
  function buildNodeHH(t: Tree, isRoot: boolean): number {
    if (!t.children || t.children.length === 0) return DROP_BOX_H / 2
    const childHHs = t.children.map(([, c]) => buildNodeHH(c, false))
    const hh = Math.max(...childHHs) + INTER_PAD
    if (!isRoot) {
      function mark(bt: Tree) {
        if (bt.children !== null && bt.children.length === 0) return  // drop lollipop, skip
        nodeHH.set(bt.cell.id, Math.max(nodeHH.get(bt.cell.id) ?? 0, hh))
        if (!bt.children) return  // edge-tree leaf stamped above, stop recursion
        for (const [, c] of bt.children) mark(c)
      }
      mark(t)
    }
    return hh
  }
  buildNodeHH(boxRoot, true)

  // depth = number of non-root intermediate box ancestors of the drop lollipop
  function walk(t: Tree, depth: number) {
    if (!t.children) return  // open leaf
    if (t.children.length === 0) {
      // nullary = drop lollipop
      const ownerId = dropOwner.get(t.cell.id)
      const ownerHH = ownerId ? (nodeHH.get(ownerId) ?? 0) : 0
      result.set(t.cell.id, Math.max(NODE_W / 2, ownerHH) + DROP_SPACER + depth * INTER_PAD)
      return
    }
    for (const [, child] of t.children) walk(child, depth + 1)
  }

  walk(boxRoot, -1)  // root at -1 so direct children start at depth 0
  return result
}

// ── computeClearances ────────────────────────────────────────────────────────
//
// Compute the minimum downward clearance each edge-tree node needs on its
// outgoing branch (between the node and its parent arc). A single map lookup
// replaces the separate drop / box calculations in Phase 3a and 3b.
//
//   clearance(n) = max(dropNeeded, boxNeeded)
//
//   yOff       = max(NODE_W/2, nodeHH) + DROP_SPACER + dropDepth * INTER_PAD
//   dropNeeded = yOff + k * DROP_UNIT + DROP_BOX_H   (0 when k = 0)
//   boxNeeded  = hh + INTER_PAD                       (0 when unwrapped)
//   hh         = DROP_BOX_H/2 + nestingDepth * INTER_PAD
//   nodeHH     = outermost wrapper hh for this edge-tree node (0 if unwrapped)
//
// Purely structural — no positions needed.

export function computeClearances(
  boxRoot: Tree | null,
  edgeRoot: Tree | null,
  dropCounts: Map<string, number>,
): Map<string, number> {
  const result = new Map<string, number>()

  // Reuse measureDropOffsets to get consistent yOffsets per drop lollipop.
  // Build dropId → ownerId map and nodeHH map from the same source.
  const dropOwner = new Map<string, string>()
  const nodeHH    = new Map<string, number>()  // outermost wrapper hh per edge-tree node

  if (edgeRoot) {
    function collectDropOwners(t: Tree) {
      if (Array.isArray(t.drops)) for (const d of t.drops) dropOwner.set(d.dropId, t.cell.id)
      if (t.children) for (const [, c] of t.children) collectDropOwners(c)
    }
    collectDropOwners(edgeRoot)
  }

  if (boxRoot) {
    function buildNodeHH(t: Tree, isRoot: boolean): number {
      if (!t.children || t.children.length === 0) return DROP_BOX_H / 2
      const childHHs = t.children.map(([, c]) => buildNodeHH(c, false))
      const hh = Math.max(...childHHs) + INTER_PAD
      if (!isRoot) {
        function mark(bt: Tree) {
          if (bt.children !== null && bt.children.length === 0) return  // drop lollipop, skip
          nodeHH.set(bt.cell.id, Math.max(nodeHH.get(bt.cell.id) ?? 0, hh))
          if (!bt.children) return  // edge-tree leaf stamped above, no children to recurse
          for (const [, c] of bt.children) mark(c)
        }
        mark(t)
      }
      return hh
    }
    buildNodeHH(boxRoot, true)
  }

  // yOffset for drops on a given edge-tree node:
  // clears the node's tower bottom (if any) plus DROP_SPACER gap.
  function dropYOff(nodeId: string, dropDepth: number): number {
    return Math.max(NODE_W / 2, nodeHH.get(nodeId) ?? 0) + DROP_SPACER + dropDepth * INTER_PAD
  }

  // Seed clearances for all nodes with drops from the edge tree.
  if (edgeRoot) {
    function seedDrops(t: Tree) {
      const k = dropCounts.get(t.cell.id) ?? 0
      if (k > 0) {
        const yOff = dropYOff(t.cell.id, 0)
        result.set(t.cell.id, yOff + k * DROP_UNIT + DROP_BOX_H)
      }
      if (t.children) for (const [, c] of t.children) seedDrops(c)
    }
    seedDrops(edgeRoot)
  }

  if (!boxRoot) return result

  // Post-order walk of box tree. depth = absolute depth in box tree (-1 for root).
  // Returns hh of the subtree rooted at t.
  function walk(t: Tree, depth: number): number {
    if (!t.children || t.children.length === 0) return DROP_BOX_H / 2
    const childHHs = t.children.map(([, c]) => walk(c, depth + 1))
    const hh = Math.max(...childHHs) + INTER_PAD
    if (depth >= 0) {  // skip root
      // markAll: stamp every edge-tree node and drop owner covered by this wrapper.
      // btDepth = absolute depth of bt in the box tree.
      function markAll(bt: Tree, btDepth: number) {
        if (bt.children !== null && bt.children.length === 0) {
          // nullary = drop lollipop at depth btDepth; stamp its edge-tree owner.
          // Tower bottom = yOff + DROP_BOX_H + btDepth * INTER_PAD.
          // Drop stack bottom = yOff + k*DROP_UNIT (+ gap = DROP_UNIT).
          const ownerId = dropOwner.get(bt.cell.id)
          if (ownerId) {
            const k = dropCounts.get(ownerId) ?? 0
            const yOff = dropYOff(ownerId, btDepth)
            const dropStackNeeded = k > 0 ? yOff + k * DROP_UNIT + DROP_BOX_H : 0
            const towerNeeded     = yOff + DROP_BOX_H + btDepth * INTER_PAD + INTER_PAD
            const boxNeeded       = hh + INTER_PAD
            result.set(ownerId, Math.max(result.get(ownerId) ?? 0,
              Math.max(dropStackNeeded, towerNeeded, boxNeeded)))
          }
          return
        }
        // Stamp edge-tree node (leaf: children=null) or wrapper node.
        // Leaf must be stamped before early return — Phase 3b looks up these ids.
        const k = dropCounts.get(bt.cell.id) ?? 0
        const yOff = dropYOff(bt.cell.id, 0)  // drops on this node are at depth 0
        const dropNeeded = k > 0 ? yOff + k * DROP_UNIT + DROP_BOX_H : 0
        const boxNeeded  = hh + INTER_PAD
        result.set(bt.cell.id, Math.max(result.get(bt.cell.id) ?? 0, Math.max(dropNeeded, boxNeeded)))
        if (!bt.children) return  // edge-tree leaf, no children to recurse into
        for (const [, c] of bt.children) markAll(c, btDepth + 1)
      }
      markAll(t, depth)
    }
    return hh
  }

  walk(boxRoot, -1)
  return result
}

// ── measureNodeHH ─────────────────────────────────────────────────────────────
//
// Returns Map<edgeNodeId, hh> where hh = DROP_BOX_H/2 + nestingDepth * INTER_PAD
// is the outermost wrapper half-height for each wrapped edge-tree node.
// Used by Phase 3b to enforce upward clearance from a parent's tower top.

export function measureNodeHH(boxRoot: Tree | null): Map<string, number> {
  const result = new Map<string, number>()
  if (!boxRoot) return result
  function walk(t: Tree, isRoot: boolean): number {
    if (!t.children || t.children.length === 0) return DROP_BOX_H / 2
    const childHHs = t.children.map(([, c]) => walk(c, false))
    const hh = Math.max(...childHHs) + INTER_PAD
    if (!isRoot) {
      function mark(bt: Tree) {
        if (bt.children !== null && bt.children.length === 0) return  // drop lollipop
        result.set(bt.cell.id, Math.max(result.get(bt.cell.id) ?? 0, hh))
        if (!bt.children) return
        for (const [, c] of bt.children) mark(c)
      }
      mark(t)
    }
    return hh
  }
  walk(boxRoot, true)
  return result
}

// ── Step 3+4: computeLayout with VPSC x-pass ─────────────────────────────────
//
// Produces a d3 hierarchy with .x / .y set on every node, plus ._stemLen on
// the root. Phases:
//   1. x: leaves evenly spread, parents at median of children (bottom-up)
//   2. y: by depth, root at bottom, leaves at top
//   VPSC: enforce sibling separation + intermediate box containment on x-axis
//   3. clearance correction (top-down, before nascent) — uses computeClearances
//   4. nascent lerp (after correction)

export function computeLayout(
  t: Tree,
  svgWidth: number,
  svgHeight: number,
  dropCounts: Map<string, number> = new Map(),
  boxRoot: Tree | null = null,
): any {
  const root = d3.hierarchy(buildHier(t))
  const innerW = (svgWidth - 2 * PAD) * 0.9

  // Phase 1 — leaf x positions (evenly spread as desired positions)
  const leaves = root.leaves()
  leaves.forEach((leaf, i) => {
    ;(leaf as any).x = leaves.length <= 1 ? innerW / 2 : (i / (leaves.length - 1)) * innerW
  })
  // bottom-up: parents at median of children
  root.eachAfter((d: any) => {
    if (!d.children) return
    const ch = (d.children as any[]).slice().sort((a, b) => a.x - b.x)
    d.x = ch.length % 2 === 1
      ? ch[Math.floor(ch.length / 2)].x
      : (ch[0].x + ch[ch.length - 1].x) / 2
  })

  // Phase 2 — y by depth
  const maxDepth = root.height || 1
  const stemLen  = TREE_H / maxDepth
  const topOff   = (svgHeight - TREE_H - stemLen) / 2
  root.each((d: any) => {
    d.x = (d.x as number) + PAD
    d.y = topOff + TREE_H - (d.depth / maxDepth) * TREE_H
  })
  ;(root as any)._stemLen = stemLen

  // ── VPSC x-pass ────────────────────────────────────────────────────────────
  //
  // Variables: one per edge-tree node, desired = Phase 1 x.
  //
  // For each edge-tree node, compute its effective half-width:
  //   - unwrapped node: NODE_W/2
  //   - node wrapped in intermediate box(es): half of the outermost wrapper's
  //     minSpan (the largest wrapper wins, so nested wrappers don't shrink it)
  //
  // Sibling separation: adjacent children must be at least
  //   leftEffectiveHW + rightEffectiveHW + H_GAP apart.
  //
  // Multi-node box containment: for intermediate boxes spanning 2+ edge-tree
  //   nodes, add a span constraint: rightmost.x - leftmost.x >= minSpan - 2*INTER_PAD.
  {
    const allNodes = root.descendants() as any[]
    const varMap = new Map<string, Variable>()
    for (const d of allNodes) {
      varMap.set(d.data.id as string, new Variable(d.x as number, 1))
    }

    // Collect all edge-tree leaf IDs under a box-tree subtree
    function edgeLeafIds(bt: Tree): string[] {
      if (!bt.children || bt.children.length === 0) return [bt.cell.id]
      return bt.children.flatMap(([, c]) => edgeLeafIds(c))
    }

    // Build effective half-width map: for each edge-tree variable,
    // the maximum half-width imposed by any intermediate wrapper around it.
    const halfWidthMap = new Map<Variable, number>()
    for (const v of varMap.values()) halfWidthMap.set(v, NODE_W / 2)

    const constraints: Constraint[] = []

    if (boxRoot) {
      const minSpans = measureMinSpans(boxRoot)

      // Walk box tree top-down; for each intermediate box update half-widths
      // and add multi-node containment constraints.
      function walkBox(bt: Tree, isRoot: boolean) {
        if (!bt.children || bt.children.length === 0) return
        for (const [, child] of bt.children) walkBox(child, false)
        if (isRoot) return
        const minSpan = minSpans.get(bt.cell.id)
        if (minSpan === undefined) return
        const hw = minSpan / 2
        const ids = edgeLeafIds(bt)
        const vars = ids.map(id => varMap.get(id)).filter(Boolean) as Variable[]
        // Inflate effective half-width of all covered nodes (max wins across nesting levels)
        for (const v of vars) halfWidthMap.set(v, Math.max(halfWidthMap.get(v)!, hw))
        // Multi-node containment: push outermost nodes apart
        if (vars.length >= 2) {
          vars.sort((a, b) => a.desiredPosition - b.desiredPosition)
          constraints.push(new Constraint(vars[0], vars[vars.length - 1], minSpan - 2 * INTER_PAD))
        }
        // Single-node wrap: the wrapped node and its entire subtree must move as a
        // rigid body, and the edge-tree parent must stay aligned above the node.
        // Use vars.length (edge-tree nodes only) not ids.length — drops appear as
        // extra lollipop IDs in ids but are absent from varMap and filtered out.
        if (vars.length === 1) {
          const nodeD = allNodes.find((d: any) => d.data.id === ids[0])
          // Equality: edge-tree parent.x == wrapped.x  (keeps branch vertical below)
          if (nodeD?.parent) {
            const parentVar = varMap.get(nodeD.parent.data.id as string)
            if (parentVar && parentVar !== vars[0]) {
              constraints.push(new Constraint(vars[0], parentVar, 0))
              constraints.push(new Constraint(parentVar, vars[0], 0))
            }
          }
          // Rigid body: each child of wrapped node keeps its Phase-1 x-offset from its parent,
          // so open branches and inner nodes above move together with the wrapped node.
          function addRigid(anc: any) {
            if (!anc.children) return
            for (const child of anc.children as any[]) {
              const aVar = varMap.get(anc.data.id as string)
              const cVar = varMap.get(child.data.id as string)
              if (aVar && cVar) {
                const offset = cVar.desiredPosition - aVar.desiredPosition
                constraints.push(new Constraint(aVar, cVar, offset))   // child >= parent + offset
                constraints.push(new Constraint(cVar, aVar, -offset))  // parent >= child - offset
              }
              addRigid(child)
            }
          }
          if (nodeD) addRigid(nodeD)
        }
      }
      walkBox(boxRoot, true)
    }

    // Sibling separation using effective half-widths
    for (const d of allNodes) {
      if (!d.children) continue
      const ch = (d.children as any[]).slice().sort((a: any, b: any) => a.x - b.x)
      for (let i = 0; i < ch.length - 1; i++) {
        const vL = varMap.get(ch[i].data.id as string)!
        const vR = varMap.get(ch[i + 1].data.id as string)!
        const sep = (halfWidthMap.get(vL) ?? NODE_W / 2) + (halfWidthMap.get(vR) ?? NODE_W / 2) + H_GAP
        constraints.push(new Constraint(vL, vR, sep))
      }
    }

    if (constraints.length > 0) {
      const vars = [...varMap.values()]
      new Solver(vars, constraints).satisfy()
      for (const d of allNodes) {
        const v = varMap.get(d.data.id as string)
        if (v) d.x = v.position()
      }
    }
  }

  // Compute per-node downward clearances and parent tower hh (purely structural)
  const clearances = computeClearances(boxRoot, t, dropCounts)
  const nodeHH     = measureNodeHH(boxRoot)

  // Phase 3a — root correction: extend stem if root's clearance exceeds stemLen
  {
    const neededStem = clearances.get((root.data as any).id as string) ?? 0
    if (neededStem > stemLen) {
      const ext = neededStem - stemLen
      root.each((n: any) => { (n as any).y -= ext })
      ;(root as any)._stemLen = neededStem
    }
  }

  // Phase 3b — non-root correction: lift subtree to satisfy two constraints:
  //   1. Downward: node's bottom extent (drops/tower) clears parent's top edge.
  //   2. Upward: node's top clears the top of parent's tower (if parent is towered).
  // Both use parent.y - NODE_W/2 - INTER_PAD as the "fence bottom" of the parent.
  root.eachBefore((d: any) => {
    if (!d.parent) return
    const parentY   = d.parent.y as number
    const parentHH  = nodeHH.get(d.parent.data.id as string) ?? 0
    const fenceBot  = parentY - NODE_W / 2 - INTER_PAD  // parent's fence bottom

    // Constraint 1: downward clearance — d must sit above fenceBot by its own clearance
    const needed = clearances.get(d.data.id as string) ?? 0
    const maxY1  = needed > 0 ? fenceBot - needed : Infinity

    // Constraint 2: upward clearance — d must sit above parent's tower top
    // Tower top = parentY - parentHH; d's node bottom = d.y + NODE_W/2
    // Required: d.y + NODE_W/2 + INTER_PAD ≤ parentY - parentHH
    const maxY2  = parentHH > 0 ? parentY - parentHH - NODE_W / 2 - INTER_PAD : Infinity

    const maxY = Math.min(maxY1, maxY2)
    if (maxY < Infinity && (d.y as number) > maxY) {
      const shift = (d.y as number) - maxY
      d.each((n: any) => { (n as any).y -= shift })
    }
  })

  // Phase 4 — nascent lerp (after correction so children slide toward corrected parent)
  root.each((d: any) => {
    if (d.data.nascent !== undefined && d.parent) {
      const n = d.data.nascent as number
      d.x = d.parent.x + n * (d.x - d.parent.x)
      d.y = d.parent.y + n * (d.y - d.parent.y)
    }
  })

  return root
}

// ── Corolla branch paths ─────────────────────────────────────────────────────

export function corollaElements(
  d: any,
  stemLen = 0,
): { branches: { id: string; path: string; vertPath: string }[] } {
  const py = d.y as number, px = d.x as number, r = ARC_R
  const branches: { id: string; path: string; vertPath: string }[] = []

  if (d.children) {
    const children = (d.children as any[]).slice().sort((a: any, b: any) => a.x - b.x)
    if (children.length === 1) {
      const p = `M${px},${py} V${children[0].y}`
      branches.push({ id: children[0].data.id, path: p, vertPath: p })
    } else {
      const xN = children[children.length - 1].x as number
      children.forEach((c: any, i: number) => {
        let path: string
        if (i === 0)
          path = `M${c.x},${c.y} V${py - r} Q${c.x},${py} ${c.x + r},${py} H${px}`
        else if (i === children.length - 1)
          path = `M${px},${py} H${xN - r} Q${xN},${py} ${xN},${py - r} V${c.y}`
        else
          path = `M${c.x},${c.y} V${py}`
        const vertPath = `M${c.x},${c.y} V${py - r}`
        branches.push({ id: c.data.id, path, vertPath })
      })
    }
  }

  if (stemLen > 0) {
    const p = `M${px},${py} V${py + stemLen}`
    branches.push({ id: d.data.id, path: p, vertPath: p })
  }

  return { branches }
}
