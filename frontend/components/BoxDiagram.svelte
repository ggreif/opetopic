<script lang="ts">
  import type { Tree, Cell } from '../lib/opetope'

  let { tree, width = 480, height = 340 }: {
    tree: Tree
    width?: number
    height?: number
  } = $props()

  // Layout constants
  const LEAF_W    = 64
  const LEAF_H    = 44
  const H_GAP     = 10   // gap between siblings
  const H_PAD     = 12   // horizontal padding inside parent box
  const V_PAD_TOP = 26   // vertical padding at top (label row)
  const V_PAD_BOT = 10   // vertical padding at bottom

  type BoxRect = {
    cell: Cell
    x: number; y: number; w: number; h: number
    children: BoxRect[]
  }

  function measure(t: Tree): { w: number; h: number } {
    if (!t.children.length) return { w: LEAF_W, h: LEAF_H }
    const kids = t.children.map(([, s]) => measure(s))
    const totalW = kids.reduce((s, k) => s + k.w, 0)
      + H_GAP * (kids.length - 1) + 2 * H_PAD
    const maxH = Math.max(...kids.map(k => k.h))
    return { w: Math.max(totalW, LEAF_W), h: maxH + V_PAD_TOP + V_PAD_BOT }
  }

  function place(t: Tree, x: number, y: number): BoxRect {
    const { w, h } = measure(t)
    if (!t.children.length) return { cell: t.cell, x, y, w, h, children: [] }
    let cx = x + H_PAD
    const cy = y + V_PAD_TOP
    const children = t.children.map(([, s]) => {
      const { w: cw } = measure(s)
      const br = place(s, cx, cy)
      cx += cw + H_GAP
      return br
    })
    return { cell: t.cell, x, y, w, h, children }
  }

  function flatten(b: BoxRect): BoxRect[] {
    return [b, ...b.children.flatMap(flatten)]
  }

  const rootSize  = $derived(measure(tree))
  const offsetX   = $derived(Math.max(0, (width  - rootSize.w) / 2))
  const offsetY   = $derived(Math.max(0, (height - rootSize.h) / 2))
  const layout    = $derived(place(tree, offsetX, offsetY))
  const allBoxes  = $derived(flatten(layout))
</script>

<svg {width} {height} class="box-diagram">
  {#each allBoxes as box}
    <rect
      x={box.x} y={box.y}
      width={box.w} height={box.h}
      rx="5" ry="5"
      class="box-rect"
    />
    <!-- label: top-right corner inside the box -->
    <text
      x={box.x + box.w - 7}
      y={box.y + 18}
      class="box-label"
    >{box.cell.label}</text>
  {/each}
</svg>

<style>
  .box-diagram {
    display: block;
    background: #fafafa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
  }

  :global(.box-rect) {
    fill: #fff;
    stroke: #333;
    stroke-width: 1.5;
  }

  :global(.box-label) {
    font-family: 'Georgia', serif;
    font-style: italic;
    font-size: 13px;
    fill: #222;
    pointer-events: none;
    text-anchor: end;
  }
</style>
