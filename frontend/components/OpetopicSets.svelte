
  <div class="ui raised segment">
    <h2 class="ui dividing header" id="osets">Opetopic Sets</h2>

    <p>
      Having established the basic geometry of opetopes in the preceding
      sections, we are now in a position to define the central notion of
      this theory.  Recall that a simplicial set is a presheaf on the
      simplex category &Delta;, that is, a contravariant functor from
      &Delta; to <b>Set</b>.  An opetopic set is the natural analogue
      of this idea for opetopes.
    </p>

    <p>
      Let <b>O</b> denote the category whose objects are opetopes and
      whose morphisms are the face maps between them.  An
      <em>opetopic set</em> is then a presheaf on <b>O</b>, i.e. a
      functor
    </p>

    <div class="ui basic center aligned segment">
      <i>X</i> : <b>O</b><sup>op</sup> &rarr; <b>Set</b>
    </div>

    <p>
      For an opetope &sigma;, the elements of the set
      <i>X</i>(&sigma;) are called the <em>cells of X of shape
      &sigma;</em>.  The face maps of <b>O</b> give rise, via
      contravariance, to the <em>boundary operations</em> of the
      opetopic set, allowing us to speak of the target and sources of
      each cell.
    </p>

    <p>
      Just as simplicial sets provide a combinatorial model for
      topological spaces, opetopic sets provide a combinatorial
      framework for higher-dimensional categorical structures.  In
      particular, opetopic sets are the raw material from which
      opetopic categories are built: an opetopic category is an
      opetopic set in which certain cells are required to satisfy
      universal properties, as described in the following sections.
    </p>

    <p>
      We note that this definition is entirely analogous to other
      presheaf-based notions of higher structure &mdash; such as
      globular sets and simplicial sets &mdash; but the opetopic shape
      theory is uniquely suited to encoding the non-symmetric,
      tree-shaped composition that is characteristic of
      higher-dimensional category theory.
    </p>

    <div class="ui secondary menu">
      <div class="item">
	<a href="/docs/diagrams/geometry#geometry" class="ui left labeled icon button">
    	  <i class="left arrow icon"></i>
    	  Prev: Geometry
	</a>
      </div>
      <div class="right menu">
	<div class="item">
	  <a href="/docs/categories/extrusions#extrusions" class="ui right labeled icon button">
    	    <i class="right arrow icon"></i>
    	    Next: Extrusions
	  </a>
	</div>
      </div>
    </div>

  </div>
