<script lang="ts">
import * as d3 from 'd3';
import { PseudoRandom, ConvexHull, isLeft, clockwiseRadialSweep, polysOverlap, TVGPoint, TangentVisibilityGraph, Calculator, tangents, Rectangle, PriorityQueue } from 'webcola';
import {onMount} from 'svelte';

let container: SVGSVGElement;
let container2: HTMLElement;

function geom(): string {
    var svg = d3.select("body").append("svg").attr("id", 1).attr("width", 300).attr("height", 200);

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
    console.log(svg)

    const child = document.createElement('circle');
/*
    return new SVGCircleElement().attr('cx', p.x)
            .attr('cy', p.y)
            .attr('fill', 'red')
            .attr('r', 35)
            .attr('stroke', "black")
            .attr('stroke-width', 20);
            */
    return "HEY!"

}

onMount(() => {
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

        //child.x(6);
        //attr('cx', 20);
		//child.textContent = 'child';
		//container.appendChild(child).attr('cx', 20);;
        container.appendChild(child)
	});

    $: svgX = `<svg id="by text" width="400" height="150"><circle r="30"/></svg>`;


</script>

{@html svgX}

<div>
    {geom()}
</div>

<svg id="surprise" width="400" height="150" bind:this={container}/>
<div bind:this={container2}/>
