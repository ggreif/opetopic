<script lang="ts">
  import * as d3 from 'd3'
  import type { Tree, AtomicDiagram, DropInfo } from '../lib/opetope'


  let {
    diagram,
    drops = [] as DropInfo[],
    width = 380,
    height = 340,
    highlight = undefined,
    onhover = undefined,
    ondropinsert = undefined,
  }: {
    diagram: AtomicDiagram
    drops?: DropInfo[]
    width?: number
    height?: number
    highlight?: string
    onhover?: (cellId: string | null) => void
    ondropinsert?: (cellId: string) => void
  } = $props()

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
    const y = leafY + (1 / 4) * (leafParentY - leafY)
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
      for (let i = 0; i < k; i++) {
        rects.push({ rootId: edgeDrops[i].rootId, x: cx - w / 3, y: nodeY + DROP_SPACER + i * DROP_UNIT, w, h: DROP_BOX_H })
      }
    }

    // Minimum y reached by any extension (for frame expansion)
    const minExtY = extensions.size > 0
      ? Math.min(...[...extensions.values()].map(e => e.yTop))
      : null

    return { rects, extensions, minExtY }
  })())

  // Expand the outer frame upward to cover any drop extensions above the leaves
  const adjustedFrameRect = $derived((() => {
    const fr = frameRect
    const extTop = dropLayout.minExtY
    if (extTop === null || extTop >= fr.y) return fr
    const newY = extTop - DROP_SPACER
    return { ...fr, y: newY, h: fr.h + (fr.y - newY) }
  })())
</script>

<svg {width} {height} class="atomic-diagram">
  <!-- ── Box layer — outer frame positioned in tree coordinates ───────────── -->
  <g class="box-layer">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g
      onmouseenter={() => onhover?.(diagram.root.cell.id)}
      onmouseleave={() => onhover?.(null)}
      opacity={diagram.root.cell.nascent ?? 1}
    >
      <rect
        x={adjustedFrameRect.x} y={adjustedFrameRect.y} width={adjustedFrameRect.w} height={adjustedFrameRect.h} rx="5" ry="5"
        class="box-rect"
        class:highlighted={diagram.root.cell.id === highlight}
        class:leaf={diagram.root.children === null || diagram.root.children.length === 0}
      />
      {#each dropLayout.rects as dr (dr.rootId)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g onmouseenter={() => onhover?.(dr.rootId)} onmouseleave={() => onhover?.(null)}>
          <rect x={dr.x} y={dr.y} width={dr.w} height={dr.h} rx="3" ry="3"
            class="box-rect leaf" class:highlighted={dr.rootId === highlight} />
        </g>
      {/each}
      <text
        x={adjustedFrameRect.x + adjustedFrameRect.w - 7} y={adjustedFrameRect.y + 18}
        class="box-label"
        class:highlighted={diagram.root.cell.id === highlight}
      >{diagram.root.cell.label}</text>
    </g>
  </g>

  <!-- ── Tree layer ────────────────────────────────────────────────────────── -->
  <g class="tree-layer">
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
      <circle cx={d.x} cy={d.y} r={NODE_R} class="tree-node" />
    {/each}
  </g>
</svg>

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
  :global(.tree-node) { fill: #333; stroke: none; }
  :global(.tree-node.highlighted) { fill: #a02480; }
</style>
