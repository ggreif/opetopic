<script lang="ts">


import Unaryex from "./svgs/unary-ex.svelte"
import Eqvnotation from "./svgs/eqv-notation.svelte"

import Equivdef from "./svgs/equiv-def.svelte"

import Ftu from "./svgs/f-tu.svelte"
import Gtu from "./svgs/g-tu.svelte"
import Etatu from "./svgs/eta-tu.svelte"
import Etaeqvtu from "./svgs/eta-eqv-tu.svelte"
import Unitl from "./svgs/unit-l.svelte"
import Alphadef from "./svgs/alpha-def.svelte"
import Betadef from "./svgs/beta-def.svelte"
import Phidef from "./svgs/phi-def.svelte"
import Psidef from "./svgs/psi-def.svelte"
import Gammadef from "./svgs/gamma-def.svelte"
import Epsilondef from "./svgs/epsilon-def.svelte"
import Epsiloneqv from "./svgs/epsilon-eqv.svelte"

</script>




  <div class="ui raised segment">
    <h2 class="ui dividing header">Equivalences</h2>

    <p>
      Let us say that an opetope is <em>unary</em> if its source
      tree consists of a single face.  With our convention for
      depicting arbitrary cells, a general unary cell looks 
      as follows:
    </p>

    <Unaryex/>
    <!-- @svg("eqvs/unary-ex.svg") -->

    <p>
      Of course, the number of input edges of <i>x</i> (and <i>y</i>) depends on the
      lower dimensional structure, and is here chosen, arbitrarily, to
      be three.
    </p>

    <p>
      As in the case for universal cells, we will use a small
      decoration to indicate that a cell is an equivalence, in
      this case, a small circle decorating its target edge like so
    </p>
    
    <Eqvnotation/>
    <!-- @svg("eqvs/eqv-notation.svg") -->

    <p>
      With these conventions in mind, the following coinductive definition of
      an equivalence in a higher category is 
      <a href="https://golem.ph.utexas.edu/category/2011/07/coinductive_definitions.html">standard</a>:
    </p>

    <div class="ui top attached inverted grey segment">
      <div class="ui header">Equivalences</div>
    </div>
    <div class="ui middle attached center aligned segment">
      <Equivdef/>
      <!-- <object type="image/svg+xml" data="/assets/svgs/eqvs/equiv-def.svg"></object> -->
    </div>
    <div class="ui bottom attached segment">
      <p>
	Definition: a unary cell <i>f</i> : <i>x</i> → <i>y</i> is said to be an equivalence if there
	exists <i>g</i> : <i>y</i> → <i>x</i> as well as higher cells <i>η</i> : <i>g</i> ∘ <i>f</i> → <i>id-x</i> and <i>ε</i> : <i>f</i> ∘ <i>g</i> → <i>id-y</i>
	such that <i>η</i> and <i>ε</i> are equivalences.
      </p>
    </div>

    <p>
      Notice how the hypothesis that <i>f</i> be unary assures that it makes
      sense to speak of a cell <i>g</i> "in the other direction", that is,
      between the target of <i>f</i> and the source of <i>f</i>, since this diagram
      remains well formed.  It is also readily checked, by symmetry,
      that <i>g</i> is also an equivalence, though we have not denoted it as
      such since it is not needed in the definition.
    </p>

    <p>
      Our goal now is to prove the following:
    </p>

    <div class="ui top attached inverted grey segment">
      <div class="ui header">Proposition</div>
    </div>
    <div class="ui bottom attached segment">
      <p>
	A unary cell is target universal if and only if it
	is an equivalence.
      </p>
    </div>

    <p>
      We think of this proposition as justifying the fact that we
      can think of target universal cells as the opetopic analog
      of equivalences or isomorphisms.  In the case of a non-unary
      cell, however, it does not make sense to speak of an inverse.
      Rather, we must use the universal property as it is given.
    </p>

    <h3 class="ui dividing header">Proof: ⇒</h3>

    <p>
      By <a href="#">stability</a>, it suffices to consider that we
      are given a target universal <em>arrow</em> <i>f</i>.
    </p>

    <Ftu/>
    <!-- @svg("eqvs/f-tu.svg") -->

    <p>
      By the definition of target universality, we obtain a lift 
      in the following diagram:
    </p>

    <Gtu/>
    <!-- @svg("eqvs/g-tu.svg") -->

    <p>
      And we see that, moreover, <i>g</i> is target universal by closure,
      since <a href="/docs/theory/units"><i>id-x</i> is</a> and <i>f</i> is by
      hypothesis.  We pause to note that we have just shown that
      any target universal unary cell admits an "inverse" which is
      also target universal.  Hence we will freely apply this
      observation to other unary, target universal cells which
      we will encounter in the proof.
    </p>

    <p>
      Continuing with our proof, we can now obtain the desired cell <i>η</i>
      using the lift
    </p>

    <Etatu/>
    <!-- @svg("eqvs/eta-tu.svg") -->

    <p>
      Furthermore, since <i>η</i> is a unary, target universal cell, we conclude
      that it is an equivalence by the coinductive hypothesis.
    </p>

    <Etaeqvtu/>
    <!-- @svg("eqvs/eta-eqv-tu.svg") -->

    <p>
      The construction of <i>ε</i> is more involved, and proceeds as follows.  First,
      recall that we have already constructed a left unit law for any arrow
      which, applied to <i>f</i>, has the form.
    </p>

    <Unitl/>
    <!-- @svg("eqvs/unit-l.svg") -->

    <p>
      Similarly, we have the right unit, <i>unit-r</i>.  From the first step of
      the proof, each of these unary, target universal cells has an inverse
      which we will denote <i>unit-l-inv</i> and <i>unit-r-inv</i> respectively in what
      follows.
    </p>

    <p>
      Our first step is to lift <i>f</i> along itself, creating the cell <i>α</i> as shown
    </p>

    <Alphadef/>
    <!-- @svg("eqvs/alpha-def.svg") -->

    <p>
      Next, we define <i>β</i> as
    </p>

    <Betadef/>
    <!-- @svg("eqvs/beta-def.svg") -->

    <p>
      And <i>φ</i> as
    </p>

    <Phidef/>
    <!-- @svg("eqvs/phi-def.svg") -->

    <p>
      Next use the source lifting property obtained from the
      definition of <i>α</i> twice, once for <i>φ</i> and once for <i>β</i>, obtaining
      the cells <i>ψ</i> and <i>γ</i> as follows:
    </p>

    <Psidef/>
    <!-- @svg("eqvs/psi-def.svg") -->

    <Gammadef/>
    <!-- @svg("eqvs/gamma-def.svg") -->

    <p>
      We now define <i>ε</i> as the composite
    </p>
    
    <Epsilondef/>
    <!-- @svg("eqvs/epsilon-def.svg") -->

    <p>
      And finally, since <i>ε</i> is a unary, target universal cell,
      we conclude that it is an equivalence by the coinductive
      hypothesis.
    </p>

    <Epsiloneqv/>
    <!-- @svg("eqvs/epsilon-eqv.svg") -->
    
    <p>
      This completes the proof.
    </p>

  </div>
