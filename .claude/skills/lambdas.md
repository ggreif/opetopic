# Lambdas — Opetopic CCCs (Speculative)

This is a brain dump / working notes toward understanding cartesian closed structure
in opetopic categories. Not founded in established CT terms yet — treat as speculation.

---

## Cartesian Closed Categories — Background

The core adjunction of a CCC:

**Hom(A × B, C) ≅ Hom(A, B ⇒ C)**

naturally in A and C. Currying is left-to-right; uncurrying right-to-left.
The counit is evaluation: **ev : (B ⇒ C) × B → C**.

---

## Products (Limits?)

In the opetopic picture, a cell's source tree has n input wires A₁, ..., Aₙ —
a naturally *tree-shaped*, non-symmetric, arbitrary-arity precursor of products.

### The product cell

A **product cell** ⊗ would have n input wires A₁, ..., Aₙ and a single output
B = A₁ ⊗ ... ⊗ Aₙ. The source tree shape *is* the product — the tree topology
directly encodes which components are being aggregated and in what arrangement.

### Projections

The **projections** πᵢ : A₁ ⊗ ... ⊗ Aₙ → Aᵢ are unary cells (single input wire)
from the aggregate back to each component. The universal property: given any cell f
with source tree matching the Aᵢ pattern, there is a unique factorization through ⊗.

### Naturality of arity

The opetopic framework handles products of any arity uniformly:
- **nullary** — the unit, arising from a drop / nullary corolla
- **unary** — trivially the identity
- **binary, ternary, ...** — freely, without artificially fixing to binary

### Is ⊗ derivable or axiomatic?

**Working hypothesis: ⊗ needs to be asserted as extra structure (or property), not
derived from the opetopic category axioms alone.**

Reasoning: the opetopic axioms give composition and universal properties — mechanisms
for *eliminating* into a target. But there is no internal mechanism that takes n
separately-existing cells and *constructs* a new cell with them as a source tree.
That aggregation step is extra.

Analogy: in plain category theory, having hom-sets does not give products for free.
Similarly, opetopic composition (substitution into a tree) does not automatically
produce objects representing tree-shaped tuples.

There may be a *weak* sense in which products are derivable: if the opetopic category
is sufficiently rich (enough universal cells), product-like objects might be
constructible by a sequence of extrusions and universal liftings — but that is
constructing them from additional structure, not from the axioms alone.

Open question: is ⊗ a **property** (the category happens to have products, detectable
by a universal property) or **structure** (an extra operation added to the signature)?
In the CCC analogy, products are a property — but one that must be asserted to hold.

---

## Exponentials

*(To be developed.)*

The currying adjunction in the opetopic setting would have to respect the tree-shaped
source structure rather than iterated binary currying. Grafting of trees corresponds
to composition, so the adjunction likely interacts deeply with opetopic composition.

Deferred until the product picture is clearer.
