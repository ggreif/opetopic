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

// ── measureBoxHH ─────────────────────────────────────────────────────────────
//
// Walk focus.root (box tree) post-order. For each edge-tree leaf wrapped by one
// or more intermediate boxes, return the outermost box's half-height:
//   hh = DROP_BOX_H/2 + nestingLevel * INTER_PAD
//
// This is purely structural — no positions needed. Returns Map<edgeNodeId, hh>;
// absent entries mean the node is not wrapped (no y-correction needed).

export function measureBoxHH(boxRoot: Tree | null, edgeRoot: Tree | null = null): Map<string, number> {
  const result = new Map<string, number>()
  if (!boxRoot) return result

  // Build dropId → ownerCellId map from the edge tree so we can stamp the
  // owner node when a wrapped intermediate box contains a drop lollipop.
  const dropOwner = new Map<string, string>()  // dropId → ownerCellId
  if (edgeRoot) {
    function collectDropOwners(t: Tree) {
      for (const d of t.drops) dropOwner.set(d.dropId, t.cell.id)
      if (t.children) for (const [, c] of t.children) collectDropOwners(c)
    }
    collectDropOwners(edgeRoot)
  }

  function walk(t: Tree, isRoot: boolean): number {
    if (!t.children || t.children.length === 0) return DROP_BOX_H / 2  // leaf seed hh
    const childHHs = t.children.map(([, c]) => walk(c, false))
    const hh = Math.max(...childHHs) + INTER_PAD
    if (!isRoot) {
      // Stamp ALL nodes (not just leaves) under this intermediate box with the outermost hh.
      // This ensures internal edge-tree nodes (e.g. after source-extrude) also get the
      // correct hh so Phase 3b can push their parent far enough.
      // Also stamp the edge-tree owner of any drop lollipop found in the subtree,
      // so Phase 3b lifts the owner node away from the bottom of the encircling tower.
      function markAll(bt: Tree) {
        result.set(bt.cell.id, Math.max(result.get(bt.cell.id) ?? 0, hh))
        if (bt.children !== null && bt.children.length === 0) {
          // nullary = drop lollipop; stamp its edge-tree owner
          const ownerId = dropOwner.get(bt.cell.id)
          if (ownerId) result.set(ownerId, Math.max(result.get(ownerId) ?? 0, hh))
        }
        if (!bt.children || bt.children.length === 0) return
        for (const [, c] of bt.children) markAll(c)
      }
      markAll(t)
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
//   3. drop correction (top-down, before nascent)
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

  // Compute intermediate box half-heights for y-correction (purely structural)
  const boxHH = measureBoxHH(boxRoot, t)

  // Phase 3a — root correction: extend stem if drops or intermediate box need room
  const rootK  = dropCounts.get((root.data as any).id as string) ?? 0
  const rootHH = boxHH.get((root.data as any).id as string) ?? 0
  {
    const neededForDrops = rootK >= 1 ? DROP_SPACER + rootK * DROP_UNIT + DROP_BOX_H : 0
    const neededForBox   = rootHH > 0 ? rootHH + DROP_SPACER : 0
    const neededStem = Math.max(neededForDrops, neededForBox)
    if (neededStem > stemLen) {
      const ext = neededStem - stemLen
      root.each((n: any) => { (n as any).y -= ext })
      ;(root as any)._stemLen = neededStem
    }
  }

  // Phase 3b — non-root correction: lift subtree so drops AND intermediate box fit on branch
  root.eachBefore((d: any) => {
    if (!d.parent) return
    const k  = dropCounts.get(d.data.id as string) ?? 0
    const hh = boxHH.get(d.data.id as string) ?? 0
    const neededForDrops = k > 0 ? DROP_SPACER + k * DROP_UNIT + DROP_BOX_H : 0
    const neededForBox   = hh > 0 ? hh + INTER_PAD : 0
    const needed = Math.max(neededForDrops, neededForBox)
    if (needed < 1) return
    const dY     = d.y as number
    const vertBot = (d.parent.y as number) - ARC_R
    const maxY   = vertBot - needed
    if (dY > maxY) {
      const shift = dY - maxY
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
