<script lang="ts">
  import * as d3 from 'd3'
  import * as cola from 'webcola'
  import { toGraph, type AtomicDiagram } from '../lib/opetope'

  let {
    diagram,
    width = 480,
    height = 320,
    highlight = undefined,
    oncellclick = undefined,
  }: {
    diagram: AtomicDiagram
    width?: number
    height?: number
    highlight?: string
    oncellclick?: (cellId: string) => void
  } = $props()

  let svgEl: SVGSVGElement
  // Stable unique id so arrow marker url(#...) stays consistent
  const uid = `op-${Math.random().toString(36).slice(2)}`

  // D3 color scale: dim 0 = blue, dim 1 = orange, dim 2 = green, ...
  const color = d3.scaleOrdinal(d3.schemeCategory10)

  function render(svgEl: SVGSVGElement, diagram: AtomicDiagram) {
    // Clear previous render
    d3.select(svgEl).selectAll('*').remove()
    const svg = d3.select(svgEl)

    const graph = toGraph(diagram)
    const nodeRadius = 8

    // Clone graph data so WebCola can mutate it
    const nodes = graph.nodes.map((n, i) => ({ ...n, index: i }))
    const links = graph.links.map(l => ({ ...l }))
    const groups = graph.groups.map(g => ({ ...g }))
    const constraints = graph.constraints

    nodes.forEach((v: any) => { v.height = v.width = 2 * nodeRadius })
    groups.forEach((g: any) => { g.padding = g.padding ?? 12 })

    const d3cola = cola.d3adaptor(d3)
      .avoidOverlaps(true)
      .size([width, height])
      .nodes(nodes)
      .links(links)
      .constraints(constraints)
      .flowLayout('y', 30)
      .symmetricDiffLinkLengths(6)
      .start(30, 0, 30)

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', `arrow-${uid}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#555')

    // Links (edge tree)
    const path = svg.selectAll('.op-link')
      .data(links)
      .enter().append('path')
      .attr('class', 'op-link')
      .attr('marker-end', `url(#arrow-${uid})`)

    // Nodes
    const node = svg.selectAll('.op-node')
      .data(nodes)
      .enter().append('g')
      .attr('class', 'op-node')
      .call(d3cola.drag as any)
      .on('click', (_event: any, d: any) => {
        oncellclick?.(d.id ?? d.name)
      })

    node.append('circle')
      .attr('r', nodeRadius)
      .attr('fill', (d: any) => color(String(d.group ?? 0)))
      .attr('stroke', '#333')
      .attr('stroke-width', 1.5)
      .attr('class', (d: any) => d.name === highlight ? 'op-highlighted' : '')

    node.append('text')
      .text((d: any) => d.name)
      .attr('text-anchor', 'middle')
      .attr('dy', -nodeRadius - 3)
      .attr('font-size', 12)
      .attr('fill', '#222')
      .attr('pointer-events', 'none')

    d3cola.on('tick', () => {
      path.attr('d', (d: any) => {
        const dx = d.target.x - d.source.x
        const dy = d.target.y - d.source.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const nx = dx / dist, ny = dy / dist
        const sx = d.source.x + nodeRadius * nx
        const sy = d.source.y + nodeRadius * ny
        const tx = d.target.x - (nodeRadius + 4) * nx
        const ty = d.target.y - (nodeRadius + 4) * ny
        return `M${sx},${sy}L${tx},${ty}`
      })

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)

    })
  }

  $effect(() => {
    // Runs after mount and whenever diagram changes
    if (svgEl) render(svgEl, diagram)
  })
</script>

<svg
  id={uid}
  bind:this={svgEl}
  {width}
  {height}
  class="opetope-diagram"
/>

<style>
  .opetope-diagram {
    display: block;
    background: #fafafa;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
  }

  :global(.op-node) {
    cursor: pointer;
  }

  :global(.op-node:hover circle) {
    stroke: #a02480;
    stroke-width: 2.5px;
  }

  :global(.op-highlighted) {
    stroke: #a02480 !important;
    stroke-width: 3px !important;
  }

  :global(.op-link) {
    fill: none;
    stroke: #555;
    stroke-width: 1.5px;
    opacity: 0.7;
  }

  :global(.op-group) {
    fill: #e8f4fd;
    stroke: #90caf9;
    stroke-width: 1.5px;
    opacity: 0.5;
  }
</style>
