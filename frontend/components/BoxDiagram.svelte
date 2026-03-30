<script lang="ts">
  import type { Tree, Cell } from '../lib/opetope'

  let { tree, width = 480, height = 340, highlight = undefined, onhover = undefined, onsourceextrude = undefined }: {
    tree: Tree
    width?: number
    height?: number
    highlight?: string
    onhover?: (cellId: string | null) => void
    onsourceextrude?: (leafId: string) => void
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
    if (t.children === null || t.children.length === 0) return { w: LEAF_W, h: LEAF_H }
    const kids = t.children.map(([, c]) => measure(c))
    const totalW = kids.reduce((acc, k) => acc + k.w, 0)
      + H_GAP * (kids.length - 1) + 2 * H_PAD
    const maxH = Math.max(...kids.map(k => k.h))
    return { w: Math.max(totalW, LEAF_W), h: maxH + V_PAD_TOP + V_PAD_BOT }
  }

  function place(t: Tree, x: number, y: number): BoxRect {
    const { w, h } = measure(t)
    if (t.children === null || t.children.length === 0) return { cell: t.cell, x, y, w, h, children: [] }
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

  const PAD = 16  // margin around the scaled content

  const rootSize  = $derived(measure(tree))
  const scale     = $derived(Math.min(
    (width  - 2 * PAD) / rootSize.w,
    (height - 2 * PAD) / rootSize.h,
    1,   // never upscale
  ))
  const scaledW   = $derived(rootSize.w * scale)
  const scaledH   = $derived(rootSize.h * scale)
  const offsetX   = $derived((width  - scaledW) / 2)
  const offsetY   = $derived((height - scaledH) / 2)
  const layout    = $derived(place(tree, 0, 0))
  const allBoxes  = $derived(flatten(layout))

  // ── Context menu ─────────────────────────────────────────────────────────────

  let ctxMenu = $state<{ x: number; y: number; leafId: string } | null>(null)

  function handleContextMenu(e: MouseEvent, box: BoxRect) {
    if (box.children.length > 0) return   // only leaf and nullary-corolla boxes
    e.preventDefault()
    ctxMenu = { x: e.clientX, y: e.clientY, leafId: box.cell.id }
  }

  function closeCtxMenu() { ctxMenu = null }

  function invokeSourceExtrude() {
    if (ctxMenu) {
      onsourceextrude?.(ctxMenu.leafId)
      ctxMenu = null
    }
  }
</script>

<svg {width} {height} class="box-diagram">
  <g transform={`translate(${offsetX},${offsetY}) scale(${scale})`}>
    {#each allBoxes as box (box.cell.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <g
        onmouseenter={() => onhover?.(box.cell.id)}
        onmouseleave={() => onhover?.(null)}
        oncontextmenu={(e) => handleContextMenu(e, box)}
        opacity={box.cell.nascent ?? 1}
      >
        <rect
          x={box.x} y={box.y}
          width={box.w} height={box.h}
          rx="5" ry="5"
          class="box-rect"
          class:highlighted={box.cell.id === highlight}
          class:leaf={box.children.length === 0}
        />
        <!-- label: top-right corner inside the box; font-size compensates for scale -->
        <text
          x={box.x + box.w - 7}
          y={box.y + 18}
          font-size={13 / scale}
          class="box-label"
          class:highlighted={box.cell.id === highlight}
        >{box.cell.label}</text>
      </g>
    {/each}
  </g>
</svg>

{#if ctxMenu}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="ctx-overlay" onclick={closeCtxMenu}></div>
  <div class="ctx-menu" style="left: {ctxMenu.x}px; top: {ctxMenu.y}px">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <button onclick={invokeSourceExtrude}>Source extrusion</button>
  </div>
{/if}

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
    vector-effect: non-scaling-stroke;
    transition: stroke-width 0.1s, stroke 0.1s;
  }

  :global(.box-rect.leaf) {
    cursor: context-menu;
  }

  :global(.box-rect.highlighted) {
    stroke: #a02480;
    stroke-width: 2.25;
  }

  :global(.box-label) {
    font-family: 'Georgia', serif;
    font-style: italic;
    font-size: 13px;
    fill: #222;
    pointer-events: none;
    text-anchor: end;
    transition: fill 0.1s, font-weight 0.1s;
  }

  :global(.box-label.highlighted) {
    fill: #a02480;
    font-weight: bold;
  }

  .ctx-overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
  }

  .ctx-menu {
    position: fixed;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    overflow: hidden;
    min-width: 160px;
  }

  .ctx-menu button {
    display: block;
    width: 100%;
    padding: 8px 16px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    font-size: 13px;
    white-space: nowrap;
  }

  .ctx-menu button:hover {
    background: #f3e5f5;
    color: #a02480;
  }
</style>
