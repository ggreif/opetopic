<script lang="ts">
  import * as d3 from 'd3'
  import type { Tree } from '../lib/opetope'

  let {
    tree,
    width = 320,
    height = 340,
    highlight = undefined,
    selectionHighlight = undefined,
    drops = [] as string[],
    onhover = undefined,
    oncellclick = undefined,
    ondropinsert = undefined,
  }: {
    tree: Tree
    width?: number
    height?: number
    highlight?: string
    selectionHighlight?: string
    drops: string[]
    onhover?: (cellId: string | null) => void
    oncellclick?: (cellId: string) => void
    ondropinsert?: (cellId: string) => void
  } = $props()

  // Count drops per cell id (duplicates allowed → k drops on one edge)
  function countDrops(ds: string[]) {
    const m = new Map<string, number>()
    for (const id of ds) m.set(id, (m.get(id) ?? 0) + 1)
    return m
  }
  const dropCounts = $derived(countDrops(drops))

  const PAD       = 28
  const NODE_R    = 4
  const ARC_R     = 6
  const TREE_H    = 88
  const LOLLIPOP_S = 16  // lollipop roundrect size (matches AtomicDiagramView)

  function buildHier(t: Tree): any {
    return {
      id:      t.cell.id,
      label:   t.cell.label,
      dim:     t.cell.dim,
      nascent: t.cell.nascent,
      nullary: t.children !== null && t.children.length === 0,
      children: t.children !== null && t.children.length > 0
        ? t.children.map(([, s]) => buildHier(s))
        : undefined,
    }
  }

  function computeLayout(t: Tree) {
    const root = d3.hierarchy(buildHier(t))
    const innerW = (width - 2 * PAD) * 0.9

    const leaves = root.leaves()
    leaves.forEach((leaf, i) => {
      ;(leaf as any).x =
        leaves.length <= 1 ? innerW / 2 : (i / (leaves.length - 1)) * innerW
    })

    root.eachAfter((d: any) => {
      if (!d.children) return
      const ch = (d.children as any[]).slice().sort((a, b) => a.x - b.x)
      if (ch.length % 2 === 1) {
        d.x = ch[Math.floor(ch.length / 2)].x
      } else {
        d.x = (ch[0].x + ch[ch.length - 1].x) / 2
      }
    })

    const maxDepth = root.height || 1
    const stemLen  = TREE_H / maxDepth
    const totalH   = TREE_H + stemLen
    const topOff   = (height - totalH) / 2
    root.each((d: any) => {
      d.x = (d.x as number) + PAD
      d.y = topOff + TREE_H - (d.depth / maxDepth) * TREE_H
    })
    ;(root as any)._stemLen = stemLen

    // Nascent nodes start at their parent's dot position and lerp toward target.
    root.each((d: any) => {
      if (d.data.nascent !== undefined && d.parent) {
        const n = d.data.nascent as number
        d.x = d.parent.x + n * (d.x - d.parent.x)
        d.y = d.parent.y + n * (d.y - d.parent.y)
      }
    })

    return root
  }

  /**
   * Decompose a corolla into per-child branch paths.
   * Each outer branch extends all the way horizontally to the dot (d.x),
   * so the full bus span is covered by the two outer branches and highlights
   * with them — no separate bus element needed.
   *
   *   left branch:  child.y → arc ╰ → bus → d.x
   *   right branch: d.x → bus → arc ╯ → child.y
   *   middle:       child.y → T-junction (vertical only)
   */
  function corollaElements(d: any, stemLen = 0): {
    branches: { id: string; path: string }[]
  } {
    const py = d.y as number
    const px = d.x as number
    const r  = ARC_R

    const branches: { id: string; path: string }[] = []

    if (d.children) {
      const children = (d.children as any[]).slice().sort((a: any, b: any) => a.x - b.x)

      if (children.length === 1) {
        branches.push({ id: children[0].data.id, path: `M${px},${py} V${children[0].y}` })
      } else {
        const x0 = children[0].x as number
        const xN = children[children.length - 1].x as number

        children.forEach((c: any, i: number) => {
          let path: string
          if (i === 0) {
            path = `M${c.x},${c.y} V${py - r} Q${c.x},${py} ${c.x + r},${py} H${px}`
          } else if (i === children.length - 1) {
            path = `M${px},${py} H${xN - r} Q${xN},${py} ${xN},${py - r} V${c.y}`
          } else {
            path = `M${c.x},${c.y} V${py}`
          }
          branches.push({ id: c.data.id, path })
        })
      }
    }

    // Output stem: same as a branch but going downward, keyed to the root's own cell.
    // Present for every root (including a leaf root like a bare point).
    if (stemLen > 0) {
      branches.push({ id: d.data.id, path: `M${px},${py} V${py + stemLen}` })
    }

    return { branches }
  }

  const hier  = $derived(computeLayout(tree))
  const nodes = $derived(hier.descendants() as any[])
</script>

<svg {width} {height} class="tree-diagram">
  <!-- Pass 1: all branch paths — stem included as a branch of the root.
       Include root even when it's a leaf (e.g. bare point) so the stem is drawn.
       Also include nullary corollas so their downward stem is drawn. -->
  {#each nodes.filter((d: any) => d.children || d.data.nullary || !d.parent) as d (d.data.id)}
    {@const { branches } = corollaElements(d, (d.parent && !d.data.nullary) ? 0 : (hier as any)._stemLen)}
    {#each branches as branch (branch.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <g
        onmouseenter={() => onhover?.(branch.id)}
        onmouseleave={() => onhover?.(null)}
        ondblclick={() => ondropinsert?.(branch.id)}
      >
        <path d={branch.path} class="corolla-link" class:highlighted={branch.id === highlight} class:selection-highlighted={branch.id === selectionHighlight} />
        <path d={branch.path} class="corolla-hit" class:droppable={!!ondropinsert} />
      </g>
    {/each}
  {/each}

  <!-- Pass 2a: drop marker on the root stem (if root is dropped) -->
  {#if dropCounts.get(hier.data.id)}
    {@const cx = hier.x as number}
    {@const y0 = hier.y as number}
    {@const stemLen = (hier as any)._stemLen}
    {@const my = y0 + stemLen / 2}
    {@const dw = 16}
    {@const dh = 11}
    <rect x={cx - dw/3} y={my - dh/2} width={dw} height={dh} rx={3} ry={3} class="drop-marker" />
  {/if}

  <!-- Pass 2b: drop markers + subdivided hit segments for each non-root branch -->
  {#each nodes.filter((d: any) => d.parent) as d (d.data.id)}
    {@const k = dropCounts.get(d.data.id) ?? 0}
    {@const cx = d.x as number}
    {@const y0 = d.y as number}
    {@const y1 = d.parent.y as number}
    {@const dw = 16}
    {@const dh = 11}
    <!-- k+1 hit segments — only when drops are active or insertable -->
    {#each (k > 0 || ondropinsert) ? Array.from({ length: k + 1 }, (_, i) => i) : [] as i}
      {@const segY0 = y0 + (i / (k + 1)) * (y1 - y0)}
      {@const segY1 = y0 + ((i + 1) / (k + 1)) * (y1 - y0)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <line
        x1={cx} y1={segY0} x2={cx} y2={segY1}
        class="drop-seg-hit"
        ondblclick={() => ondropinsert?.(d.data.id)}
      />
    {/each}
    <!-- k slashed roundrect markers at the junctions between segments -->
    {#each Array.from({ length: k }, (_, i) => i) as i}
      {@const my = y0 + ((i + 1) / (k + 1)) * (y1 - y0)}
      <rect x={cx - dw/3} y={my - dh/2} width={dw} height={dh} rx={3} ry={3} class="drop-marker" />
    {/each}
  {/each}

  <!-- Edge labels: midpoint of the vertical edge leading to each non-root node -->
  {#each nodes.filter((d: any) => d.parent) as d (d.data.id)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <text
      x={(d.x as number) + 5}
      y={(d.y as number) + ((d.parent.y as number) - (d.y as number)) * 2 / 3 + 4}
      class="edge-label"
      class:highlighted={d.data.id === highlight}
      onmouseenter={() => onhover?.(d.data.id)}
      onmouseleave={() => onhover?.(null)}
    >{d.data.label}</text>
  {/each}

  <!-- Root label on the output stem -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <text
    x={(hier.x as number) + 5}
    y={(hier.y as number) + (hier as any)._stemLen * 2 / 3 + 4}
    class="edge-label"
    class:highlighted={hier.data.id === highlight}
    onmouseenter={() => onhover?.(hier.data.id)}
    onmouseleave={() => onhover?.(null)}
  >{hier.data.label}</text>

  <!-- Pass 3: roundrects for all nodes (inner nodes + lollipops) -->
  {#each nodes.filter((d: any) => d.children || d.data.nullary) as d (d.data.id)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <rect
      x={(d.x as number) - LOLLIPOP_S / 2} y={(d.y as number) - LOLLIPOP_S / 2}
      width={LOLLIPOP_S} height={LOLLIPOP_S}
      rx="3" ry="3"
      class="tree-node"
      onclick={() => oncellclick?.(d.data.id)}
    />
  {/each}
</svg>

<style>
  .tree-diagram {
    display: block;
    background: #fafafa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: visible;
  }

  :global(.corolla-link) {
    fill: none;
    stroke: #444;
    stroke-width: 1.5;
    stroke-linecap: round;
    pointer-events: none;
    transition: stroke-width 0.1s, stroke 0.1s;
  }

  :global(.corolla-hit) {
    fill: none;
    stroke: transparent;
    stroke-width: 2.25;
    stroke-linecap: round;
    pointer-events: stroke;
  }

  :global(.corolla-hit.droppable) {
    cursor: cell;
  }

  :global(.drop-seg-hit) {
    stroke: transparent;
    stroke-width: 12;
    cursor: cell;
    pointer-events: stroke;
  }

  :global(.drop-marker) {
    fill: #fff;
    stroke: #555;
    stroke-width: 1.5;
    pointer-events: none;
  }

  :global(.drop-slash) {
    stroke: #555;
    stroke-width: 1.5;
    stroke-linecap: round;
    pointer-events: none;
  }

  :global(.corolla-link.highlighted) {
    stroke: #a02480;
    stroke-width: 2.25;
  }

  :global(.corolla-link.selection-highlighted) {
    stroke: #e53935;
    stroke-width: 2.25;
  }

  :global(.tree-node) {
    cursor: pointer;
    fill: #333;
    stroke: none;
    pointer-events: all;
    transition: fill 0.1s;
  }

  :global(.tree-node.highlighted) {
    fill: #a02480;
  }

  :global(.edge-label) {
    font-family: 'Georgia', serif;
    font-style: italic;
    font-size: 12px;
    fill: #222;
    pointer-events: all;
    cursor: default;
    transition: fill 0.1s, font-weight 0.1s;
  }

  :global(.edge-label.highlighted) {
    fill: #a02480;
    font-weight: bold;
  }

</style>
