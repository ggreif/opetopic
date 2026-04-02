<script lang="ts">
  import * as d3 from 'd3'
  import type { Tree, AtomicDiagram, DropInfo } from '../lib/opetope'


  let {
    diagram,
    drops = [] as DropInfo[],
    width = 380,
    height = 340,
    highlight = undefined,
    highlightNode = undefined,
    selected = undefined,
    onhover = undefined,
    onnodehover = undefined,
    onselect = undefined,
    ondropinsert = undefined,
    onencircle = undefined,
  }: {
    diagram: AtomicDiagram
    drops?: DropInfo[]
    width?: number
    height?: number
    highlight?: string
    highlightNode?: string
    selected?: string
    onhover?: (cellId: string | null) => void
    onnodehover?: (cellId: string | null) => void
    onselect?: (cellId: string | null) => void
    ondropinsert?: (cellId: string) => void
    onencircle?: (cellId: string) => void
  } = $props()

  // ── Context menu for encircle ────────────────────────────────────────────────
  let ctxMenu = $state<{ x: number; y: number; cellId: string } | null>(null)

  const droppedEdgeIds = $derived(new Set(drops.map(d => d.edgeId)))

  // ── Box layout — frame rect derived from tree coordinates ───────────────────

  const LEAF_W = 64, H_PAD_L = 28, H_PAD_R = 32

  // Outer frame box position is dictated by the tree geometry:
  //   top    = leafY + 2/3 * (parentOfLeaf.y − leafY)  — crosses uppermost branches at 2/3 height
  //   bottom = busY + stemLen / 3                       — crosses output stem at 1/3 down
  //   left/right = min/max leaf x ± H_PAD
  const frameRect = $derived((() => {
    const busY    = hier.y as number
    const stemLen = (hier as any)._stemLen as number
    const leafNodes = nodes.filter((d: any) => !d.children)
    const leafY  = leafNodes.length > 0 ? Math.min(...leafNodes.map((d: any) => d.y as number)) : busY
    const leafXs = leafNodes.length > 0 ? leafNodes.map((d: any) => d.x as number) : [hier.x as number]
    // Parent y of the uppermost leaves (one branch step below their tips)
    const uppermostLeaves = leafNodes.filter((d: any) => Math.abs((d.y as number) - leafY) < 1)
    const leafParentY = uppermostLeaves.length > 0 && uppermostLeaves[0].parent
      ? (uppermostLeaves[0].parent.y as number)
      : busY
    const minX = Math.min(...leafXs)
    const maxX = Math.max(...leafXs)
    const x = minX - H_PAD_L
    // Symmetric overhang: leaves poke above by stemLen/4, stem pokes below by stemLen/4
    const y = leafY + stemLen / 4
    const w = Math.max(maxX - minX + H_PAD_L + H_PAD_R, LEAF_W)
    const h = (busY + stemLen * 3 / 4) - y
    return { x, y, w, h }
  })())

  // ── Tree layout (from TreeDiagram) ──────────────────────────────────────────

  const PAD = 28, NODE_R = 4, ARC_R = 6, TREE_H = 88

  // Drop box geometry — defined here so computeLayout can use them
  const DROP_W     = H_PAD_L + H_PAD_R
  const DROP_BOX_H = 16
  const DROP_SPACER = 4
  const DROP_UNIT   = DROP_BOX_H + DROP_SPACER

  function buildHier(t: Tree): any {
    return {
      id: t.cell.id, label: t.cell.label, dim: t.cell.dim, nascent: t.cell.nascent,
      children: t.children !== null ? t.children.map(([, s]) => buildHier(s)) : undefined,
    }
  }

  function computeLayout(t: Tree, dropCounts: Map<string, number> = new Map()) {
    const root = d3.hierarchy(buildHier(t))
    const innerW = (width - 2 * PAD) * 0.9
    const leaves = root.leaves()
    leaves.forEach((leaf, i) => {
      ;(leaf as any).x = leaves.length <= 1 ? innerW / 2 : (i / (leaves.length - 1)) * innerW
    })
    root.eachAfter((d: any) => {
      if (!d.children) return
      const ch = (d.children as any[]).slice().sort((a, b) => a.x - b.x)
      d.x = ch.length % 2 === 1 ? ch[Math.floor(ch.length / 2)].x : (ch[0].x + ch[ch.length - 1].x) / 2
    })
    const maxDepth = root.height || 1
    const stemLen = TREE_H / maxDepth
    const topOff = (height - TREE_H - stemLen) / 2
    root.each((d: any) => {
      d.x = (d.x as number) + PAD
      d.y = topOff + TREE_H - (d.depth / maxDepth) * TREE_H
    })
    ;(root as any)._stemLen = stemLen
    // Drop correction — must run BEFORE nascent so nascent children interpolate
    // toward already-lifted parent positions.
    // Root case: extend the stem downward by lifting the whole tree upward.
    const rootK = dropCounts.get((root.data as any).id as string) ?? 0
    if (rootK >= 1) {
      const neededStem = DROP_SPACER + rootK * DROP_UNIT + DROP_BOX_H
      if (stemLen < neededStem) {
        const ext = neededStem - stemLen
        root.each((n: any) => { (n as any).y -= ext })
        ;(root as any)._stemLen = neededStem
      }
    }
    // Non-root case: lift each node (and its subtree) so all k drop boxes fit
    // on the branch toward its parent.
    root.eachBefore((d: any) => {
      const k = dropCounts.get(d.data.id as string) ?? 0
      if (k < 1 || !d.parent) return
      const dY = d.y as number
      const vertBot = (d.parent.y as number) - ARC_R
      const needed = DROP_SPACER + k * DROP_UNIT + DROP_BOX_H
      const maxY = vertBot - needed
      if (dY > maxY) {
        const shift = dY - maxY
        d.each((n: any) => { (n as any).y -= shift })
      }
    })
    // Nascent adjustment — after correction so children slide toward corrected parent
    root.each((d: any) => {
      if (d.data.nascent !== undefined && d.parent) {
        const n = d.data.nascent as number
        d.x = d.parent.x + n * (d.x - d.parent.x)
        d.y = d.parent.y + n * (d.y - d.parent.y)
      }
    })
    return root
  }

  function corollaElements(d: any, stemLen = 0): { branches: { id: string; path: string; vertPath: string }[] } {
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
          if (i === 0)                        path = `M${c.x},${c.y} V${py - r} Q${c.x},${py} ${c.x + r},${py} H${px}`
          else if (i === children.length - 1) path = `M${px},${py} H${xN - r} Q${xN},${py} ${xN},${py - r} V${c.y}`
          else                                path = `M${c.x},${c.y} V${py}`
          // vertPath: only the vertical segment from leaf tip to bus level
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

  const dropCountsByEdge = $derived((() => {
    const m = new Map<string, number>()
    for (const d of drops) m.set(d.edgeId, (m.get(d.edgeId) ?? 0) + 1)
    return m
  })())

  const hier  = $derived(computeLayout(diagram.edgeRoot, dropCountsByEdge))
  const nodes = $derived(hier.descendants() as any[])

  // ── Intermediate boxes — non-root, non-leaf nodes of focus.root ──────────────
  // After encircle, focus.root gains wrapper nodes that have no counterpart in
  // edgeRoot. We render them as nested box rects around their leaf descendants'
  // tree-node rects.
  const INTER_PAD = 10

  type InterBox = { cell: { id: string; label: string; dim: number }; x: number; y: number; w: number; h: number }

  const intermediateBoxes = $derived((() => {
    if (!diagram.root) return [] as InterBox[]
    const s = DROP_BOX_H / 2

    // Map edge-tree cell.id → layout position
    const posMap = new Map<string, { x: number; y: number }>()
    for (const d of nodes) posMap.set(d.data.id as string, { x: d.x as number, y: d.y as number })

    // Collect all leaf-box cell IDs under a focus.root subtree
    function leafIds(t: Tree): string[] {
      if (!t.children || t.children.length === 0) return [t.cell.id]
      return t.children.flatMap(([, c]) => leafIds(c))
    }

    const result: InterBox[] = []
    function walk(t: Tree, isRoot: boolean) {
      if (!t.children) return  // leaf box in focus.root
      if (!isRoot) {
        const ids = leafIds(t)
        const positions = ids.map(id => posMap.get(id)).filter(Boolean) as { x: number; y: number }[]
        if (positions.length > 0) {
          const minX = Math.min(...positions.map(p => p.x - s)) - INTER_PAD
          const maxX = Math.max(...positions.map(p => p.x + s)) + INTER_PAD
          const minY = Math.min(...positions.map(p => p.y - s)) - INTER_PAD
          const maxY = Math.max(...positions.map(p => p.y + s)) + INTER_PAD
          result.push({ cell: t.cell, x: minX, y: minY, w: maxX - minX, h: maxY - minY })
        }
      }
      for (const [, child] of t.children) walk(child, false)
    }
    walk(diagram.root, true)
    return result
  })())

  // ── Drop boxes — one per drop, stacking upward above the leaf for k > 1 ─────

  type DropRect = { rootId: string; x: number; y: number; w: number; h: number }
  type DropExt  = { x: number; yTop: number; yBot: number }

  const dropLayout = $derived((() => {
    const rects: DropRect[] = []
    const extensions = new Map<string, DropExt>()  // edgeId → extension line

    // Group by edgeId, preserving insertion order
    const byEdge = new Map<string, DropInfo[]>()
    for (const d of drops) {
      if (!byEdge.has(d.edgeId)) byEdge.set(d.edgeId, [])
      byEdge.get(d.edgeId)!.push(d)
    }

    for (const [edgeId, edgeDrops] of byEdge) {
      const d = nodes.find((n: any) => n.data.id === edgeId) as any
      if (!d) continue
      const cx  = d.x as number
      const w   = d.parent ? DROP_W : DROP_W / 2
      const k   = edgeDrops.length
      const nodeY = d.y as number

      // Stack boxes downward from the node into its outgoing branch (toward parent / stem).
      // Box i top: nodeY + DROP_SPACER + i * DROP_UNIT  (all below nodeY, no extension needed)
      const bw = DROP_BOX_H * 1.5  // narrow box width — same for all branches
      for (let i = 0; i < k; i++) {
        rects.push({ rootId: edgeDrops[i].rootId, x: cx - bw / 3, y: nodeY + DROP_SPACER + i * DROP_UNIT, w: bw, h: DROP_BOX_H })
      }
    }

    // Minimum y reached by any extension (for frame expansion)
    const minExtY = extensions.size > 0
      ? Math.min(...[...extensions.values()].map(e => e.yTop))
      : null

    return { rects, extensions, minExtY }
  })())

  // Expand the outer frame to cover all drop boxes (upward for child drops, downward for stem drops)
  const adjustedFrameRect = $derived((() => {
    const fr = frameRect
    const frBot = fr.y + fr.h
    const minRectY = dropLayout.rects.length > 0 ? Math.min(...dropLayout.rects.map(r => r.y))           : null
    const maxRectB = dropLayout.rects.length > 0 ? Math.max(...dropLayout.rects.map(r => r.y + r.h))     : null
    const newTop = minRectY !== null && minRectY < fr.y   ? minRectY - DROP_SPACER : fr.y
    const newBot = maxRectB !== null && maxRectB > frBot   ? maxRectB + DROP_SPACER : frBot
    if (newTop === fr.y && newBot === frBot) return fr
    return { ...fr, y: newTop, h: newBot - newTop }
  })())

  // All leaf tips should reach this y — same overhang above frame as stem below
  const leafCeiling = $derived(adjustedFrameRect.y - DROP_SPACER)
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<svg {width} {height} class="atomic-diagram" onclick={() => onselect?.(null)}>
  <!-- ── Box layer — outer frame positioned in tree coordinates ───────────── -->
  {#if diagram.root}
  <g class="box-layer">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g
      onmouseenter={() => { onhover?.(diagram.root!.cell.id); onnodehover?.(diagram.root!.cell.id) }}
      onmouseleave={() => { onhover?.(null); onnodehover?.(null) }}
      opacity={diagram.root!.cell.nascent ?? 1}
    >
      <rect
        x={adjustedFrameRect.x} y={adjustedFrameRect.y} width={adjustedFrameRect.w} height={adjustedFrameRect.h} rx="5" ry="5"
        class="box-rect"
        class:highlighted={diagram.root!.cell.id === highlight || diagram.root!.cell.id === highlightNode}
        class:leaf={diagram.root!.children === null || diagram.root!.children.length === 0}
      />
      <text
        x={adjustedFrameRect.x + adjustedFrameRect.w - 7} y={adjustedFrameRect.y + 18}
        class="box-label"
        class:highlighted={diagram.root!.cell.id === highlight}
      >{diagram.root!.cell.label}</text>
    </g>
    <!-- Intermediate boxes (wrapper disks added by encircle) -->
    {#each intermediateBoxes as ib (ib.cell.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <g
        onmouseenter={() => { onhover?.(ib.cell.id); onnodehover?.(ib.cell.id) }}
        onmouseleave={() => { onhover?.(null); onnodehover?.(null) }}
      >
        <rect x={ib.x} y={ib.y} width={ib.w} height={ib.h} rx="5" ry="5"
          class="box-rect"
          class:highlighted={ib.cell.id === highlight || ib.cell.id === highlightNode}
        />
        <text x={ib.x + ib.w - 7} y={ib.y + 18} class="box-label"
          class:highlighted={ib.cell.id === highlight}
        >{ib.cell.label}</text>
      </g>
    {/each}
    <!-- Drop boxes: outside the frame <g> so their hover doesn't bubble to the frame -->
    {#each dropLayout.rects as dr (dr.rootId)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <g
        onmouseenter={() => { onhover?.(dr.rootId); onnodehover?.(dr.rootId) }}
        onmouseleave={() => { onhover?.(null); onnodehover?.(null) }}
      >
        <rect x={dr.x} y={dr.y} width={dr.w} height={dr.h} rx="3" ry="3"
          class="box-rect leaf"
          class:highlighted={dr.rootId === highlight || dr.rootId === highlightNode} />
      </g>
    {/each}
  </g>
  {/if}

  <!-- ── Tree layer ────────────────────────────────────────────────────────── -->
  <g class="tree-layer">
    <!-- Leaf tip extensions: ensure every open branch tip reaches leafCeiling -->
    {#each nodes.filter((d: any) => !d.children && d.parent) as d (d.data.id)}
      {#if (d.y as number) > leafCeiling}
        {@const p = `M${d.x as number},${d.y as number} V${leafCeiling}`}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <g onmouseenter={() => onhover?.(d.data.id)} onmouseleave={() => onhover?.(null)}>
          <path d={p} class="corolla-link" class:highlighted={d.data.id === highlight} />
          <path d={p} class="corolla-hit" />
          {#if ondropinsert}
            <path d={p} class="corolla-hit droppable" ondblclick={() => ondropinsert?.(d.data.id)} />
          {/if}
        </g>
      {/if}
    {/each}

    <!-- Branch extensions for multi-drop stacking -->
    {#each [...dropLayout.extensions.entries()] as [edgeId, ext]}
      {@const p = `M${ext.x},${ext.yTop} V${ext.yBot}`}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <g
        onmouseenter={() => onhover?.(edgeId)}
        onmouseleave={() => onhover?.(null)}
      >
        <path d={p} class="corolla-link" class:highlighted={edgeId === highlight} />
        <path d={p} class="corolla-hit" />
        {#if ondropinsert}
          <path d={p} class="corolla-hit droppable" ondblclick={() => ondropinsert?.(edgeId)} />
        {/if}
      </g>
    {/each}

    {#each nodes.filter((d: any) => d.children || !d.parent) as d (d.data.id)}
      {@const { branches } = corollaElements(d, d.parent ? 0 : (hier as any)._stemLen)}
      {#each branches as branch (branch.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <g
          onmouseenter={() => onhover?.(branch.id)}
          onmouseleave={() => onhover?.(null)}
        >
          <path d={branch.path} class="corolla-link" class:highlighted={branch.id === highlight} />
          <path d={branch.path} class="corolla-hit" />
          {#if ondropinsert}
            <path d={branch.vertPath} class="corolla-hit droppable" ondblclick={() => ondropinsert?.(branch.id)} />
          {/if}
        </g>
      {/each}
    {/each}

    {#each nodes.filter((d: any) => d.parent) as d (d.data.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <text
        x={(d.x as number) + 5} y={(d.y as number) + ((d.parent.y as number) - (d.y as number)) * 2 / 3 + 4}
        class="edge-label" class:highlighted={d.data.id === highlight}
        onmouseenter={() => onhover?.(d.data.id)} onmouseleave={() => onhover?.(null)}
      >{d.data.label}</text>
    {/each}

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <text
      x={(hier.x as number) + 5} y={(hier.y as number) + (hier as any)._stemLen * 2 / 3 + 4}
      class="edge-label" class:highlighted={hier.data.id === highlight}
      onmouseenter={() => onhover?.(hier.data.id)} onmouseleave={() => onhover?.(null)}
    >{hier.data.label}</text>

    {#each nodes.filter((d: any) => d.children) as d (d.data.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <rect
        x={(d.x as number) - DROP_BOX_H / 2} y={(d.y as number) - DROP_BOX_H / 2}
        width={DROP_BOX_H} height={DROP_BOX_H}
        rx="3" ry="3"
        class="tree-node"
        class:highlighted={d.data.id === highlightNode}
        class:selected={d.data.id === selected}
        onmouseenter={() => onnodehover?.(d.data.id)}
        onmouseleave={() => onnodehover?.(null)}
        onclick={(e) => {
          e.stopPropagation()
          onselect?.(d.data.id === selected ? null : d.data.id)
        }}
        oncontextmenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          if (d.data.id === selected) {
            ctxMenu = { x: e.clientX, y: e.clientY, cellId: d.data.id }
          }
        }}
      />
    {/each}
  </g>
</svg>

{#if ctxMenu}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="ctx-overlay" onclick={() => ctxMenu = null}></div>
  <div class="ctx-menu" style="left:{ctxMenu.x}px; top:{ctxMenu.y}px">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <button onclick={() => { onencircle?.(ctxMenu!.cellId); ctxMenu = null }}>Encircle</button>
  </div>
{/if}

<style>
  .atomic-diagram {
    display: block;
    background: #fafafa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: visible;
  }

  /* Box layer */
  :global(.box-rect) {
    fill: rgba(255,255,255,0.5);
    stroke: #333;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  :global(.box-rect.leaf) { cursor: context-menu; }
  :global(.box-rect.highlighted) { stroke: #a02480; stroke-width: 2.25; }
  :global(.box-label) {
    font-family: 'Georgia', serif;
    font-style: italic;
    font-size: 13px;
    fill: #222;
    pointer-events: none;
    text-anchor: end;
  }
  :global(.box-label.highlighted) { fill: #a02480; font-weight: bold; }
  :global(.drop-slash-box) {
    stroke: #666;
    stroke-width: 1.5;
    stroke-linecap: round;
    pointer-events: none;
    vector-effect: non-scaling-stroke;
  }

  /* Tree layer */
  :global(.corolla-link) {
    fill: none; stroke: #444; stroke-width: 1.5; stroke-linecap: round; pointer-events: none;
  }
  :global(.corolla-link.highlighted) { stroke: #a02480; stroke-width: 2.25; }
  :global(.corolla-hit) {
    fill: none; stroke: transparent; stroke-width: 10; stroke-linecap: round; pointer-events: stroke;
  }
  :global(.corolla-hit.droppable) { cursor: cell; }
  :global(.edge-label) {
    font-family: 'Georgia', serif;
    font-style: italic;
    font-size: 12px;
    fill: #222;
    pointer-events: all;
    cursor: default;
  }
  :global(.edge-label.highlighted) { fill: #a02480; font-weight: bold; }
  :global(.tree-node) {
    fill: white;
    stroke: #333;
    stroke-width: 1.5;
    cursor: pointer;
    pointer-events: all;
    vector-effect: non-scaling-stroke;
    transition: fill 0.1s, stroke 0.1s;
  }
  :global(.tree-node.highlighted) { stroke: #a02480; stroke-width: 2.25; }
  :global(.tree-node.selected) { fill: #e53935; cursor: context-menu; }

  .ctx-overlay {
    position: fixed; inset: 0; z-index: 99;
  }
  .ctx-menu {
    position: fixed; z-index: 100;
    background: white; border: 1px solid #ccc; border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15); padding: 4px 0;
  }
  .ctx-menu button {
    display: block; width: 100%; padding: 6px 16px;
    background: none; border: none; cursor: pointer;
    font-size: 0.9em; text-align: left;
  }
  .ctx-menu button:hover { background: #f3e5f5; color: #a02480; }
</style>
