<script lang="ts">

import Xdef from "./svgs/x-def.svelte"
import Xpaste from "./svgs/x-paste.svelte"
import Fdef from "./svgs/f-def.svelte"
import Idxdef from "./svgs/id-x-def.svelte"
import Iduniv from "./svgs/id-univ.svelte"
import Fcompid from "./svgs/f-comp-id.svelte"
import Unitrdef from "./svgs/unit-r-def.svelte"
import Unitr from "./svgs/unit-r.svelte"

</script>

  <div class="ui raised segment">
    <h2 class="ui dividing header" id="units">Identities and Units</h2>

    <p>
      Let us start with an object <i>x</i> in an opetopic category.
    </p>

    <Xdef/>
    <!-- @svg("units/x-def.svg") -->

    <p>
      Then there is a canonical pasting diagram, the empty pasting diagram
      on <i>x</i>, which is represented by the trivial tree in dimension 1.  This
      pasting diagram is depicted as follows:
    </p>

    <Xpaste/>
    <!-- @svg("units/x-paste.svg") -->

    <p>
      According to the first axiom of an opetopic category, this diagram 
      admits a target universal filler which looks as follows:
    </p>

    <Idxdef/>
    <!-- @svg("units/id-x-def.svg") -->

    <p>
      Moreover, applying the second axiom of an opetopic category, we learn
      that in fact, the composite, which we have called <i>id-x</i>, is in fact itself
      target universal.
    </p>

    <Iduniv/>
    <!-- @svg("units/id-univ.svg") -->

    <p>
      In order to justify that the cell obtained in this manner behaves as an
      identity, let us suppose that we have an arrow <i>f</i> with source <i>x</i>:
    </p>

    <Fdef/>
    <!-- @svg("units/f-def.svg") -->

    <p>
      We may then form the composite of <i>f</i> and <i>id-x</i> as follows:
    </p>

    <Fcompid/>
    <!-- @svg("units/f-comp-id.svg") -->

    <p>
      If we now compose <i>α</i> with the filler obtained in the definition
      of <i>id-x</i>, we obtain the following:
    </p>

    <Unitrdef/>
    <!-- @svg("units/unit-r-def.svg") -->

    <p>
      Where the left universality of the resulting cell follows from
      the closure of target universal cells under composition.  Taking
      a look at the resulting cell, we see that we have constructed a
      left universal cell connecting <i>f</i> and <i>f</i> ∘ <i>id-x</i>, whose shape is 
      simply that of a 2-glob:
    </p>

    <Unitr/>
    <!-- @svg("units/unit-r.svg") -->

    <p>
      We interpret this cell as the right unit law of our higher
      category.  In the next section, we will justify the intuition
      that this cell is in fact an <em>equivalence</em> between <i>f</i> and
      <i>f</i> ∘ <i>id-x</i>.
    </p>

  </div>
