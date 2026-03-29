<script lang="ts">
  import * as d3 from 'd3'
  import type { Tree } from '../lib/opetope'

  let {
    tree,
    width = 320,
    height = 340,
    oncellclick = undefined,
  }: {
    tree: Tree
    width?: number
    height?: number
    oncellclick?: (cellId: string) => void
  } = $props()

  const PAD   = 30
  const NODE_R = 4
  const ARC_R  = 7   // rounded corner radius on bus ends

  function buildHier(t: Tree): any {
    return {
      id:    t.cell.id,
      label: t.cell.label,
      dim:   t.cell.dim,
      children: t.children.length
        ? t.children.map(([, s]) => buildHier(s))
        : undefined,
    }
  }

  function computeLayout(t: Tree) {
    const root = d3.hierarchy(buildHier(t))
    const innerW = width  - 2 * PAD
    const innerH = height - 2 * PAD
    d3.tree<any>().size([innerW, innerH])(root)
    // Flip y so root is at BOTTOM (opetope convention: output below)
    root.each((d: any) => {
      d.x = (d.x as number) + PAD
      d.y = innerH - (d.y as number) + PAD
    })
    return root
  }

  const hier  = $derived(computeLayout(tree))
  const nodes = $derived(hier.descendants() as any[])

  /**
   * Corolla path for an internal node d:
   *
   *   │     │     │       ← child stems going upward
   *   ╰──●──╯             ← bus through the node dot, arcs at ends
   *        │              ← output downward (drawn separately)
   *
   * Each child drops a vertical to the bus level (d.y).
   * The leftmost and rightmost children get a rounded-corner arc (╰ / ╯).
   * Intermediate children T-intersect the bus with a straight drop.
   */
  function corollaPath(d: any): string {
    const children = (d.children as any[]).slice().sort((a: any, b: any) => a.x - b.x)
    const py = d.y as number
    const r  = ARC_R

    if (children.length === 1) {
      const c = children[0]
      return `M${c.x},${c.y} V${py}`
    }

    const x0 = children[0].x as number
    const xN = children[children.length - 1].x as number

    // One continuous path: left-child drop → arc → bus → arc → right-child rise
    let p = `M${x0},${children[0].y} V${py - r} Q${x0},${py} ${x0 + r},${py}`
    p    += ` H${xN - r} Q${xN},${py} ${xN},${py - r} V${children[children.length - 1].y}`

    // Intermediate children: straight vertical drop to the bus (T-junction)
    for (let i = 1; i < children.length - 1; i++) {
      const c = children[i]
      p += ` M${c.x},${c.y} V${py}`
    }

    return p
  }

  // Short output stem below the root node
  function outputStem(d: any): string {
    return `M${d.x},${d.y} V${(d.y as number) + 22}`
  }
</script>

<svg {width} {height} class="tree-diagram">
  <!-- Corolla links for every internal node -->
  {#each nodes.filter((d: any) => d.children) as d}
    <path d={corollaPath(d)} class="corolla-link" />
  {/each}

  <!-- Output stem below root -->
  <path d={outputStem(hier)} class="output-stem" />

  <!-- Nodes (dots + labels) -->
  {#each nodes as d}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <circle
      cx={d.x} cy={d.y} r={NODE_R}
      class="tree-node dim-{d.data.dim}"
      onclick={() => oncellclick?.(d.data.id)}
    />
    <text
      x={(d.x as number) + NODE_R + 5}
      y={(d.y as number) + 4}
      class="tree-label"
    >{d.data.label}</text>
  {/each}
</svg>

<style>
  .tree-diagram {
    display: block;
    background: #fafafa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
  }

  :global(.corolla-link) {
    fill: none;
    stroke: #555;
    stroke-width: 1.5;
    stroke-linecap: round;
  }

  :global(.output-stem) {
    fill: none;
    stroke: #999;
    stroke-width: 1.5;
    stroke-dasharray: 3,3;
  }

  :global(.tree-node) {
    cursor: pointer;
    fill: #333;
    stroke: none;
  }
  :global(.tree-node.dim-2) { fill: #7b1fa2; }
  :global(.tree-node.dim-1) { fill: #1565c0; }
  :global(.tree-node.dim-0) { fill: #2e7d32; }

  :global(.tree-label) {
    font-family: 'Georgia', serif;
    font-style: italic;
    font-size: 12px;
    fill: #222;
    pointer-events: none;
  }
</style>
