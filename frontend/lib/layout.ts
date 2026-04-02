/**
 * Pure layout functions for edge trees.
 *
 * Extracted from AtomicDiagramView.svelte so they can be shared with
 * TreeDiagram.svelte and tested independently. No Svelte dependencies.
 *
 * Migration plan: this module will grow to host the VPSC-based constraint
 * layout (see layouting.md skill). For now it is a pure extraction with no
 * behaviour change.
 */

import * as d3 from 'd3'
import type { Tree } from './opetope'

// ── Layout constants ─────────────────────────────────────────────────────────

export const PAD        = 28
export const ARC_R      = 6
export const TREE_H     = 88
export const DROP_BOX_H = 16
export const DROP_SPACER = 4
export const DROP_UNIT   = DROP_BOX_H + DROP_SPACER  // 20

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

// ── Tree layout ───────────────────────────────────────────────────────────────
//
// Produces a d3 hierarchy with .x / .y set on every node, plus ._stemLen on
// the root. Phases:
//   1. x: leaves evenly spread, parents at median of children (bottom-up)
//   2. y: by depth, root at bottom, leaves at top
//   3. drop correction (top-down, before nascent)
//   4. nascent lerp (after correction)

export function computeLayout(
  t: Tree,
  svgWidth: number,
  svgHeight: number,
  dropCounts: Map<string, number> = new Map(),
): any {
  const root = d3.hierarchy(buildHier(t))
  const innerW = (svgWidth - 2 * PAD) * 0.9
  const leaves = root.leaves()
  leaves.forEach((leaf, i) => {
    ;(leaf as any).x = leaves.length <= 1 ? innerW / 2 : (i / (leaves.length - 1)) * innerW
  })
  root.eachAfter((d: any) => {
    if (!d.children) return
    const ch = (d.children as any[]).slice().sort((a, b) => a.x - b.x)
    d.x = ch.length % 2 === 1
      ? ch[Math.floor(ch.length / 2)].x
      : (ch[0].x + ch[ch.length - 1].x) / 2
  })
  const maxDepth = root.height || 1
  const stemLen  = TREE_H / maxDepth
  const topOff   = (svgHeight - TREE_H - stemLen) / 2
  root.each((d: any) => {
    d.x = (d.x as number) + PAD
    d.y = topOff + TREE_H - (d.depth / maxDepth) * TREE_H
  })
  ;(root as any)._stemLen = stemLen

  // Phase 3a — root drop correction (extend stem downward = lift whole tree)
  const rootK = dropCounts.get((root.data as any).id as string) ?? 0
  if (rootK >= 1) {
    const neededStem = DROP_SPACER + rootK * DROP_UNIT + DROP_BOX_H
    if (stemLen < neededStem) {
      const ext = neededStem - stemLen
      root.each((n: any) => { (n as any).y -= ext })
      ;(root as any)._stemLen = neededStem
    }
  }

  // Phase 3b — non-root drop correction (lift subtree so drops fit on branch)
  root.eachBefore((d: any) => {
    const k = dropCounts.get(d.data.id as string) ?? 0
    if (k < 1 || !d.parent) return
    const dY     = d.y as number
    const vertBot = (d.parent.y as number) - ARC_R
    const needed  = DROP_SPACER + k * DROP_UNIT + DROP_BOX_H
    const maxY    = vertBot - needed
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
