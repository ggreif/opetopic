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

  const PAD    = 28
  const NODE_R = 4
  const ARC_R  = 6
  const TREE_H = 88   // vertical span root→leaves

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

  /**
   * Custom layout — avoids d3.tree()'s "average of all descendants" parent
   * placement, which shifts the root away from the middle child when subtrees
   * are unequal.
   *
   * Rules (applied bottom-up after leaf x positions are set uniformly):
   *   • odd number of children  → parent.x = middle child.x
   *   • even number of children → parent.x = midpoint of leftmost/rightmost child
   *
   * This guarantees that for a 3-child node [L, M, R] the parent sits
   * directly above M, so the middle corolla branch lands exactly on the dot.
   */
  function computeLayout(t: Tree) {
    const root = d3.hierarchy(buildHier(t))
    const innerW = width - 2 * PAD

    // Step 1: uniform x for leaves
    const leaves = root.leaves()
    leaves.forEach((leaf, i) => {
      ;(leaf as any).x =
        leaves.length <= 1 ? innerW / 2 : (i / (leaves.length - 1)) * innerW
    })

    // Step 2: internal x — bottom-up
    root.eachAfter((d: any) => {
      if (!d.children) return
      const ch = (d.children as any[]).slice().sort((a, b) => a.x - b.x)
      if (ch.length % 2 === 1) {
        d.x = ch[Math.floor(ch.length / 2)].x   // above middle child
      } else {
        d.x = (ch[0].x + ch[ch.length - 1].x) / 2  // midpoint of range
      }
    })

    // Step 3: y by depth; leaves at top, root at bottom.
    // stemLen = one branch step — same length as each ascending branch segment.
    const maxDepth = root.height || 1
    const stemLen  = TREE_H / maxDepth
    const totalH   = TREE_H + stemLen
    const topOff   = (height - totalH) / 2
    root.each((d: any) => {
      d.x = (d.x as number) + PAD
      // flip: depth 0 (root) → bottom; depth maxDepth (leaves) → top
      d.y = topOff + TREE_H - (d.depth / maxDepth) * TREE_H
    })
    ;(root as any)._stemLen = stemLen

    return root
  }

  const hier  = $derived(computeLayout(tree))
  const nodes = $derived(hier.descendants() as any[])

  /**
   * Corolla path for an internal node d.
   * Bus is AT the dot (busY = py) — horizontal lines originate from the dot.
   *
   *   │     │     │       ← child stems coming down
   *   ╰──●──╯             ← bus at py; dot at (px,py) sits on the bus
   *        │              ← output stem (drawn separately)
   *
   * With the custom layout, the middle child of an odd-count node shares x
   * with the parent, so its T-junction lands exactly on the dot.
   */
  function corollaPath(d: any): string {
    const children = (d.children as any[]).slice().sort((a: any, b: any) => a.x - b.x)
    const py = d.y as number
    const r  = ARC_R

    if (children.length === 1) {
      // Single child: straight vertical from dot to child
      return `M${d.x},${py} V${children[0].y}`
    }

    const x0 = children[0].x as number
    const xN = children[children.length - 1].x as number

    // Left arm: child drop → arc (╰) → bus rightward
    let p = `M${x0},${children[0].y} V${py - r}`
    p    += ` Q${x0},${py} ${x0 + r},${py}`
    // Bus to right arc
    p    += ` H${xN - r}`
    // Right arc (╯) → child rise
    p    += ` Q${xN},${py} ${xN},${py - r} V${children[children.length - 1].y}`

    // Intermediate children: T-junctions straight to bus/dot level
    for (let i = 1; i < children.length - 1; i++) {
      p += ` M${children[i].x},${children[i].y} V${py}`
    }

    return p
  }
</script>

<svg {width} {height} class="tree-diagram">
  <!-- Corolla links for every internal node -->
  {#each nodes.filter((d: any) => d.children) as d}
    <path d={corollaPath(d)} class="corolla-link" />
  {/each}

  <!-- Output stem below root: same length as one ascending branch segment -->
  <path
    d={`M${hier.x},${hier.y} V${(hier.y as number) + (hier as any)._stemLen}`}
    class="corolla-link"
  />

  <!-- Dots only at corolla nodes (internal nodes with branches).
       Leaf nodes are open branch ends — no dot. -->
  {#each nodes.filter((d: any) => d.children) as d}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <circle
      cx={d.x} cy={d.y} r={NODE_R}
      class="tree-node"
      onclick={() => oncellclick?.(d.data.id)}
    />
  {/each}

  <!-- Edge labels: each cell label sits at the midpoint of the edge leading to
       that cell's dot. In the tree, edges ARE the faces (boxes in the other pane).
       Non-root: midpoint between parent.y and child.y at child.x.
       Root: midpoint of the output stem. -->
  {#each nodes.filter((d: any) => d.parent) as d}
    <text
      x={(d.x as number) + 5}
      y={((d.y as number) + (d.parent.y as number)) / 2 + 4}
      class="edge-label"
    >{d.data.label}</text>
  {/each}
  <!-- Root label on the output stem -->
  <text
    x={(hier.x as number) + 5}
    y={(hier.y as number) + (hier as any)._stemLen / 2 + 4}
    class="edge-label"
  >{hier.data.label}</text>
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
  }

  :global(.tree-node) {
    cursor: pointer;
    fill: #333;
    stroke: none;
  }

  :global(.edge-label) {
    font-family: 'Georgia', serif;
    font-style: italic;
    font-size: 12px;
    fill: #222;
    pointer-events: none;
  }
</style>
