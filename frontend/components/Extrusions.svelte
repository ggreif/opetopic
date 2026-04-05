<script lang="ts">

import Head from "./svgs/head.svelte"
import Cellctxt from "./svgs/cellctxt.svelte"
import LeftExtrusion from "./svgs/LeftExtrusion.svelte"
import RightExtrusion from "./svgs/RightExtrusion.svelte"

let leftStep  = $state<"start" | "extrude" | "enclose">("extrude")
let rightStep = $state<"start" | "extrude" | "enclose">("extrude")

</script>


  <div class="ui raised segment">
    <h2 class="ui dividing header" id="extrusions">Extrusions</h2>

    <p>
      We will be interested in this section in two constructions
      which can be made on an arbitrary cell, embedding it in
      a diagram of the next higher dimension. 
    </p>

    <p>
      We first fix some notation.  Consider the diagram below:
    </p>

    <div class="ui basic center aligned segment">
      <Head/>
      <!-- <object type="image/svg+xml" data="/assets/svgs/head.svg"></object> -->
    </div>

    <p>
      Recall that according to our definition, an opetope must
      finish with a single cell in the top dimension.  In view of
      the bonding relationship, this implies that the codimension 1
      part of the diagram consists of a single box, the target of
      the cell, as well as an arbitrary tree consisting of its sources.
    </p>

    <p>
      We will refer to the top dimensional cell, together with its
      codimension 1 part as the <em>head</em> of the diagram as
      indicated.  Moreover, to depict a cell of arbitrary dimension,
      we will depict just the head, using an ellipsis to denote
      the lower dimensional part.
    </p>

    <p>
      With the above considerations established, the following is
      meant to indicate a cell f of some arbitrary dimension with
      its codimension 1 faces depicted as well.
    </p>

    <div class="ui basic center aligned segment">
      <Cellctxt/>
      <!-- <object type="image/svg+xml" data="/assets/svgs/cellctxt.svg"></object>-->
    </div>

    <p>
      Notice that we must choose <em>some</em> tree in our diagram to 
      serve as the source tree for the cell f, but it will be clear
      from what follows that our constructions do not depend in any
      way on the shape of this tree.
    </p>

    <h3 class="ui dividing header">Target Extrusion</h3>

    <p>
      Our first construction is called a target extrusion and is 
      demonstrated in the interactive display below.
    </p>

    <div class="ui attached center aligned segment">
      <LeftExtrusion step={leftStep}/>
      <!-- <svg width="360" height="175" id="lext-svg"></svg> -->
    </div>
    <div class="ui bottom attached center aligned segment">
      <div class="ui buttons">
        <button class="ui button" class:active={leftStep === "start"}   onclick={() => leftStep = "start"}>Start</button>
        <button class="ui button" class:active={leftStep === "extrude"} onclick={() => leftStep = "extrude"}>Extrude</button>
        <button class="ui button" class:active={leftStep === "enclose"} onclick={() => leftStep = "enclose"}>Enclose</button>
      </div>
    </div>

    <p>
      Notice that the extrusion consists of two steps: first,
      enclose the target in a new box, modifying the edge tree
      of the next dimension to accomodate the bonding relation.
      Next, enclose the remaining tree and add a new top dimensional
      cell.
    </p>

    <h3 class="ui dividing header">Source Extrusions</h3>

    <p>
      Source extrusions are similar, but work with respect to
      a given source cell.  In the following demonstration,
      we perform a "source extrusion at x".  It should be clear
      that the same construction can be applied equally well
      to any other chosen source face.
    </p>

    <div class="ui attached center aligned segment">
      {#if rightStep === "extrude"}
        <RightExtrusion/>
      {:else if rightStep === "start"}
        <RightExtrusion showRedCells={false}/>
      {:else if rightStep === "enclose"}
        <RightExtrusion showGreenBox={true}/>
      {/if}
      <!-- <svg width="360" height="175" id="rext-svg"></svg> -->
    </div>
    <div class="ui bottom attached center aligned segment">
      <div class="ui buttons">
        <button class="ui button" class:active={rightStep === "start"}   onclick={() => rightStep = "start"}>Start</button>
        <button class="ui button" class:active={rightStep === "extrude"} onclick={() => rightStep = "extrude"}>Extrude</button>
        <button class="ui button" class:active={rightStep === "enclose"} onclick={() => rightStep = "enclose"}>Enclose</button>
      </div>
    </div>

    <p>
      Observe that in the source extrusion, we add a new
      cell "above" the chosen source face, taking care
      to maintain the bonding relationship, and then 
      enclosing the resulting diagram with a target box,
      resulting in a new opetopic diagram.
    </p>

    <div class="ui secondary menu">
      <div class="item">
	<a href="/docs/diagrams/osets" class="ui left labeled icon button">
    	  <i class="left arrow icon"></i>
    	  Prev: Opetopic Sets
	</a>
      </div>
      <div class="right menu">
	<div class="item">
	  <a href="/docs/categories/uprops" class="ui right labeled icon button">
    	    <i class="right arrow icon"></i>
    	    Next: Universal Properties
	  </a>
	</div>
      </div>
    </div>

  </div>

