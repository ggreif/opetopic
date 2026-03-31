<script lang="ts">
  import * as d3 from 'd3'
  import type { Tree, AtomicDiagram, Drop } from '../lib/opetope'

  let {
    diagram,
    drops = [] as Drop[],
    width = 380,
    height = 340,
    highlight = undefined,
    onhover = undefined,
    ondropinsert = undefined,
  }: {
    diagram: AtomicDiagram
    drops?: Drop[]
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

  function buildHier(t: Tree): any {
    return {
      id: t.cell.id, label: t.cell.label, dim: t.cell.dim, nascent: t.cell.nascent,
      children: t.children !== null ? t.children.map(([, s]) => buildHier(s)) : undefined,
    }
  }

  function computeLayout(t: Tree) {
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
    root.each((d: any) => {
      if (d.data.nascent !== undefined && d.parent) {
        const n = d.data.nascent as number
        d.x = d.parent.x + n * (d.x - d.parent.x)
        d.y = d.parent.y + n * (d.y - d.parent.y)
      }
    })
    return root
  }

  function corollaElements(d: any, stemLen = 0): { branches: { id: string; path: string }[] } {
    const py = d.y as number, px = d.x as number, r = ARC_R
    const branches: { id: string; path: string }[] = []
    if (d.children) {
      const children = (d.children as any[]).slice().sort((a: any, b: any) => a.x - b.x)
      if (children.length === 1) {
        branches.push({ id: children[0].data.id, path: `M${px},${py} V${children[0].y}` })
      } else {
        const xN = children[children.length - 1].x as number
        children.forEach((c: any, i: number) => {
          let path: string
          if (i === 0)                        path = `M${c.x},${c.y} V${py - r} Q${c.x},${py} ${c.x + r},${py} H${px}`
          else if (i === children.length - 1) path = `M${px},${py} H${xN - r} Q${xN},${py} ${xN},${py - r} V${c.y}`
          else                                path = `M${c.x},${c.y} V${py}`
          branches.push({ id: c.data.id, path })
        })
      }
    }
    if (stemLen > 0) branches.push({ id: d.data.id, path: `M${px},${py} V${py + stemLen}` })
    return { branches }
  }

  const hier  = $derived(computeLayout(diagram.edgeRoot))
  const nodes = $derived(hier.descendants() as any[])

  // ── Drop segment boxes — one slashed rect per drop, tracking its branch ─────

  const DROP_W = H_PAD_L + H_PAD_R  // total width of a drop box

  const dropRects = $derived(drops.map(({ edgeId, rootId }) => {
    const d = nodes.find((n: any) => n.data.id === edgeId) as any
    if (!d) return null
    let segY0: number, segY1: number
    if (!d.parent) {
      const stemLen = (hier as any)._stemLen as number
      segY0 = (d.y as number) + stemLen / 4
      segY1 = (d.y as number) + stemLen * 3 / 4
    } else {
      segY0 = (d.y as number) + ((d.parent.y as number) - (d.y as number)) / 4
      segY1 = (d.y as number) + ((d.parent.y as number) - (d.y as number)) * 3 / 4
    }
    const cx = d.x as number
    return { edgeId, rootId, x: cx - DROP_W / 2, y: segY0, w: DROP_W, h: segY1 - segY0 }
  }).filter(Boolean) as { edgeId: string; rootId: string; x: number; y: number; w: number; h: number }[])
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
        x={frameRect.x} y={frameRect.y} width={frameRect.w} height={frameRect.h} rx="5" ry="5"
        class="box-rect"
        class:highlighted={diagram.root.cell.id === highlight}
        class:leaf={diagram.root.children === null || diagram.root.children.length === 0}
      />
      {#each dropRects as dr (dr.edgeId)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <g onmouseenter={() => onhover?.(dr.rootId)} onmouseleave={() => onhover?.(null)}>
          <rect x={dr.x} y={dr.y} width={dr.w} height={dr.h} rx="3" ry="3"
            class="box-rect leaf" class:highlighted={dr.rootId === highlight} />
          <line x1={dr.x + 4} y1={dr.y + 4} x2={dr.x + dr.w - 4} y2={dr.y + dr.h - 4} class="drop-slash-box" />
        </g>
      {/each}
      <text
        x={frameRect.x + frameRect.w - 7} y={frameRect.y + 18}
        class="box-label"
        class:highlighted={diagram.root.cell.id === highlight}
      >{diagram.root.cell.label}</text>
    </g>
  </g>

  <!-- ── Tree layer ────────────────────────────────────────────────────────── -->
  <g class="tree-layer">
    {#each nodes.filter((d: any) => d.children || !d.parent) as d (d.data.id)}
      {@const { branches } = corollaElements(d, d.parent ? 0 : (hier as any)._stemLen)}
      {#each branches as branch (branch.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <g
          onmouseenter={() => onhover?.(branch.id)}
          onmouseleave={() => onhover?.(null)}
          ondblclick={() => ondropinsert?.(branch.id)}
        >
          <path d={branch.path} class="corolla-link" class:highlighted={branch.id === highlight} />
          <path d={branch.path} class="corolla-hit" class:droppable={!!ondropinsert} />
        </g>
      {/each}
    {/each}

    {#each nodes.filter((d: any) => d.parent) as d (d.data.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <text
        x={(d.x as number) + 5} y={((d.y as number) + (d.parent.y as number)) / 2 + 4}
        class="edge-label" class:highlighted={d.data.id === highlight}
        onmouseenter={() => onhover?.(d.data.id)} onmouseleave={() => onhover?.(null)}
      >{d.data.label}</text>
    {/each}

    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <text
      x={(hier.x as number) + 5} y={(hier.y as number) + (hier as any)._stemLen / 2 + 4}
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
