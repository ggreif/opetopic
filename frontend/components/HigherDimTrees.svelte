<script lang="ts">
import Point from "./svgs/point.svelte"
import SList from "./svgs/list.svelte"
import TwoTree from "./svgs/twotree.svelte"
import ThreeTree from "./svgs/threetree.svelte"
</script>

<div class="ui raised segment">
  <h2 class="ui dividing header">Higher Dimensional Trees</h2>

  <p>
    Opetopes are a collection of polytopes which correspond
    to certain well-formed higher dimensional trees.  It takes
    some work to make precise what one means by well-formed,
    so in this section, we will warm up with a simpler definition
    of what exactly is a higher dimensional tree, and we will
    use this to motivate the definition of opetopes to follow.
  </p>

  <p>
    We begin by examining some low dimensional incarnations
    of trees.  The data type definitions which follow are
    given in two forms, one using more or less standard naming
    conventions, and the other named in order to bring out
    the pattern we are trying to generalize.
  </p>

  <p>
    A zero-dimensional tree is just a point.  As we want to
    consider trees with nodes labeled in some type <i>A</i>, this
    means that the type constructor corresponding to
    zero-dimensional trees is the <code>Id</code> constructor, which is
    presented below.
  </p>

  <div class="ui celled grid">
    <div class="eight wide column">
      <pre><code>data Id (A : Set) : Set where
  id : A -> Id A</code></pre>
    </div>
    <div class="eight wide column">
      <pre><code>data Tree0 (A : Set) : Set where
  pt0 : A -> Tree0 A</code></pre>
    </div>
  </div>

  <p>
    We can make a picture of an element of our type, say with <i>A</i> taken
    to be the natural numbers.  As described, the identity constructor
    gives us just a single point of data.
  </p>

  <div class="ui basic center aligned segment">
    <Point/>
  </div>

  <p>
    Now consider the following two definitions of list.
  </p>

  <div class="ui celled grid">
    <div class="eight wide column">
      <pre><code>data List (A : Set) : Set where
  nil  : List A
  cons : A -> Id (List A) -> List A</code></pre>
    </div>
    <div class="eight wide column">
      <pre><code>data Tree1 (A : Set) : Set where
  leaf1 : Tree1 A
  node1 : A -> Tree0 (Tree1 A)
            -> Tree1 A</code></pre>
    </div>
  </div>

  <p>
    The picture of a list is slightly more interesting.
  </p>

  <div class="ui basic center aligned segment">
    <SList/>
  </div>

  <p>
    Next, here are the definitions in dimension 2.
  </p>

  <div class="ui celled grid">
    <div class="eight wide column">
      <pre><code>data Tree (A : Set) : Set where
  leaf : Tree A
  node : A -> List (Tree A) -> Tree A</code></pre>
    </div>
    <div class="eight wide column">
      <pre><code>data Tree2 (A : Set) : Set where
  leaf2 : Tree2 A
  node2 : A -> Tree1 (Tree2 A)
            -> Tree2 A</code></pre>
    </div>
  </div>

  <p>
    And now we get to a traditional, two-dimensional tree.
  </p>

  <div class="ui basic center aligned segment">
    <TwoTree/>
  </div>

  <p>
    Looking back at our definitions, we can see that we can immediately generalize
    our trees to all dimensions with the following indexed inductive type.
  </p>

  <div class="ui celled grid">
    <div class="sixteen wide column">
      <pre><code>{'data Tree (A : Set) : N -> Set where\n  pt   : A -> Tree A 0\n  leaf : {n : N} -> Tree A (S n)\n  node : {n : N} -> A -> Tree (Tree A (S n)) n -> Tree A (S n)'}</code></pre>
    </div>
  </div>

  <p>
    Here is a picture of the three dimensional tree:
  </p>

  <div class="ui basic center aligned segment">
    <ThreeTree/>
  </div>

</div>
