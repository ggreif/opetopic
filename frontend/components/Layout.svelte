<script lang="ts">
import * as d3 from 'd3';
//import { PseudoRandom, ConvexHull, isLeft, clockwiseRadialSweep, polysOverlap, TVGPoint, TangentVisibilityGraph, Calculator, tangents, Rectangle, PriorityQueue } from 'webcola';

import * as cola from 'webcola'
//import {InputNode} from 'webcola'
import {onMount} from 'svelte';

let container: SVGSVGElement;
let container2: HTMLElement;

// describe the bond tree as an object
type Tree = undefined | Node
interface Node { 
    [label: string]: Tree
}

const t: Tree = {f: {b: undefined, d: {a: undefined}, e: {c: undefined}}}

function createTree(label: string, t: Node, into: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>) {
    function distributeEdges(edges: Array<string>) {
        const [side, rest] = [edges.length / 3, edges.length % 3]
        const sideEdges = side + rest / 2
        const topEdges = side + rest % 2
        // console.log(sideEdges, topEdges)
        return [sideEdges, topEdges]
    }

    const edges = Object.keys(t)
    // we have 3 sides on this node, distribute the edges
    distributeEdges(edges)
    for (const k of edges) {
        //console.log(k)

    }
}

const width = 960,
      height = 500;

type Graph = {
    nodes: cola.InputNode[];
    links: /*cola.Link<NodeRefType>*/{target: number, source: number, value: number}[];
    groups: Array<any>/*cola.Group[]*/;
    constraints: Array<any>/*{axis: string, left: number, right: number, gap: number}*/[]
}

async function downward(svg: d3.Selection<d3.BaseType, unknown, HTMLElement, any>) {
    var color = d3.scaleOrdinal(d3.schemeCategory10);

    var d3cola = cola.d3adaptor(d3)
        .avoidOverlaps(true)
        .size([width, height]);

    let graph = await d3.json("./chris.json")
    .then((g: any) => <Graph>g).then(
    function (graph: Graph) {
        //let graph = {...graph0, groups: [{"leaves":[77,79]}]}
        var nodeRadius = 5;
        //console.log(graph)

        graph.nodes.forEach(function (v: any) { v.height = v.width = 2 * nodeRadius; });
        graph.groups.forEach(function (g: any) { g.padding = 12 });
        //console.log(graph.groups)

        /*let n1: cola.Node = 77
        let n2: cola.Node = 79
        let n3: cola.Node = 78*/
        //let groups: cola.Group[] = [{leaves:[n1, n2, n3], padding: 12}]

        d3cola
            .nodes(graph.nodes)
            .links(graph.links)
            .groups(graph.groups)
            .flowLayout("y", 30)
            .symmetricDiffLinkLengths(6)
            .start(10,20,20);

        // define arrow markers for graph links
        svg.append('svg:defs').append('svg:marker')
            .attr('id', 'end-arrow')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 6)
            .attr('markerWidth', 3)
            .attr('markerHeight', 3)
            .attr('orient', 'auto')
          .append('svg:path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#000');

        var path = svg.selectAll(".link")
            .data(graph.links)
          .enter().append('path')
            .attr('class', 'link');

        var node = svg.selectAll(".node")
            .data(graph.nodes)
          .enter().append("circle")
            .attr("class", "node")
            .attr("r", nodeRadius)
            .style("fill", function (d: any) { return color(d.group); })
            .call(d3cola.drag);

        var group = svg.selectAll(".group")
            .data(graph.groups)
          .enter().append("rect")
            .attr("rx", 8).attr("ry", 8)
            .attr("class", "group")
            //.style("fill", function (d, i) { return color(i); })
            .call(d3cola.drag);
        //console.log(group)

        node.append("title")
            .text(function (d: any) { return d.name; });

        d3cola.on("tick", function () {
            // draw directed edges with proper padding from node centers
            path.attr('d', function (d: any) {
                var deltaX = d.target.x - d.source.x,
                    deltaY = d.target.y - d.source.y,
                    dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
                    normX = deltaX / dist,
                    normY = deltaY / dist,
                    sourcePadding = nodeRadius,
                    targetPadding = nodeRadius + 2,
                    sourceX = d.source.x + (sourcePadding * normX),
                    sourceY = d.source.y + (sourcePadding * normY),
                    targetX = d.target.x - (targetPadding * normX),
                    targetY = d.target.y - (targetPadding * normY);
                return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
            });

            node.attr("cx", function (d: any) { return d.x; })
                .attr("cy", function (d: any) { return d.y; });

            group.attr("x", function (d: any) { return d.bounds.x; })
                .attr("y", function (d: any) { return d.bounds.y; })
                .attr("width", function (d: any) { return d.bounds.width(); })
                .attr("height", function (d: any) { return d.bounds.height(); });


        });
    });
}

function geom(): string {
    const svg = d3.select("body").append("svg").attr("id", 1).attr("width", 300).attr("height", 200);

    const l = {x1: 30, y1: 0, x2: 45, y2: 24};
    function drawLine(svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>, stroke = "green") {

        svg.append("line")
            .attr('x1', 10 * l.x1)
            .attr('y1', 10 * l.y1)
            .attr('x2', 10 * l.x2)
            .attr('y2', 10 * l.y2)
            .attr('stroke', stroke)
            .attr('stroke-width', 20);
    }

    drawLine(svg)

    const p = { x: 22, y :48 }
    function drawCircle(svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>, stroke = "blue") {
        svg.append("circle")
            .attr('cx', p.x)
            .attr('cy', p.y)
            .attr('fill', 'red')
            .attr('r', 35)
            .attr('stroke', stroke)
            .attr('stroke-width', 20);
    }

    function midPoint(p: string | any[]) {
        var mx = 0, my = 0;
        var n = p.length - 1;
        for (var i = 0; i < n; i++) {
            var q = p[i];
            mx += q.x;
            my += q.y;
        }
        return { x: mx / n, y: my / n };
    }

    drawCircle(svg)

    const child = document.createElement('circle');

    return "HEY!"
}

onMount(async () => {
    const child2 = document.createElement('span');
		child2.textContent = 'child';
		container2.appendChild(child2);

		const child = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        //d3.select
        child.setAttribute('cx', "22");
        child.setAttribute('cy', "13");
        child.setAttribute('r', "10");
        child.setAttribute('stroke', "black");
        child.setAttribute('stroke-width', "7");
        child.setAttribute('fill', 'red')

        container.appendChild(child)

        const svg = d3.select("#surprise")
        svg.append("rect")
            .attr('x', 34)
            .attr('y', 4)
            .attr('width', 40)
            .attr('height', 15)
            //.attr('fill', "red") -- steered by 'class'
            .attr('stroke', "orange")
            .attr('class', "variable")

        const rootLabel = "f"
        createTree(rootLabel, <Node>t.f, d3.select("#surprise"))
        downward(svg)
        console.log(svg)
	});

let svgX = $state(`<svg id="by text" width="400" height="150"><circle r="30"/></svg>`);

</script>

{@html svgX}

<div>
    {geom()}
</div>

<svg id="surprise" {width} {height} bind:this={container}/>
<div bind:this={container2}/>

<style>
    :global(.node) {
        stroke: #830505;
        stroke-width: 1.5px;
    }

    :global(.link) {
        fill: none;
        stroke: #000;
        stroke-width: 1.5px;
        opacity: 0.4;
        marker-end: url(#end-arrow);
    }

    :global(.group) {
        fill: red;
        stroke: #fff;
        stroke-width: 1.5px;
        opacity: 0.7;
    }

</style>
