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

### The diagonal — bifurcating a wire

The crux of cartesian vs. monoidal: opetopic diagrams are normally **linear** — each
wire is used exactly once. There is no native diagonal Δ : A → A ⊗ A. So how do we
get copying?

**Drops as duplication macros.** A drop on an input branch of a corolla is reinterpreted
as a routing instruction — a macro for the diagonal. Concretely, in a dim-2 diagram:

- A **bare drop** on input i: duplicate — feed the same value into the next unconnected
  slot of the corolla below
- A **singly encircled drop**: skip one slot, feed into the second unconnected slot
- Deeper nesting: feed into the nth unconnected slot

These are all macros for the **fundamental diagonal**, which can be drawn explicitly as
a wire that curves back within the box — entirely within existing opetopic diagram syntax,
no new notation needed. The drop is just the compact encoding of that routing.

Geometrically: the diagonal is a wire identity, just routed. The opetopic diagram already
has room for this since wires can travel arbitrarily within a box.

### The construction

The setup is a **planar tree** (dim-2 opetope) built in the editor, with:
- Drops placed on the inputs (branches) of the tree
- The **n-ary worker morphism** sitting in the node box

The tree must be planar — this gives a canonical left-to-right ordering of inputs,
which is essential for the routing/indexing of drops to be well-defined.

### The cartesian flag — the jump to CCC

The crucial distinction:

- **Unmarked input**: linear — wire used exactly once, standard opetopic regime
- **Flagged input**: cartesian — drops on this input are interpreted as diagonals,
  breaking linearity

The flag lives **on the input** of the corolla, depicted as a small white circle with
a dot — mimicking the **!** (bang) modality of linear logic. This marks that input's
resource as freely duplicable.

- **Contraction** (copying) = diagonal drop on a flagged input
- **Weakening** (discarding) = an input with no node below (dangling wire)

Once an input is flagged, everything else follows:
- The ⊗ morphism (product cell) exists
- Projections πᵢ exist
- The splitting-the-identity equation holds
- The full cartesian universal property is derivable

So the opetopic account gives a clean geometric story: **cartesian closed is the
sub-theory where certain corolla inputs are flagged with !**, and that decoration is
the only extra axiom needed on top of the base opetopic category structure.

---

## Exponentials — Dissecting Binary Morphisms

The exponential (function object, internal hom) is forced into existence by a single
identity equation — the **counit of the curry/apply adjunction**:

**b(x, y) = @(curry(b)(x), y)**

for any binary morphism b with inputs x and y. This is the *dissection* of b along
one of its input wires.

### What this forces

- **curry(b)** — a unary morphism taking x, producing an intermediate "waiting for y"
  object: the exponential Y^X (or X ⇒ Y)
- **@** (apply/eval) — takes the curried result together with y and recovers b

Neither curry nor @ is constructed independently — they are *jointly* forced into
existence by demanding this single identity. The equation says: the direct 2-input
cell b and the factored diagram @∘(curry(b) × id) are **equal as cells** in the
opetopic category.

### Layered structure

The full CCC construction has a clean layered form, each layer adding exactly one
identity axiom:

1. **Base** — opetopic categories: linear, tree-shaped composition
2. **Products** — flag inputs with !, drops give diagonal, ⊗ forced by
   splitting-the-identity: `⊗(π₁(x), ..., πₙ(x)) = id(x)`
3. **Exponentials** — curry/@ forced by dissecting binary morphisms:
   `b(x, y) = @(curry(b)(x), y)`

Layers 2 and 3 are **independent** — neither presupposes the other:

- **Monoidal closed** = base + exponentials (layer 3 alone): curry/@ exist without
  any diagonal. x appears exactly once on each side of the dissection equation —
  it is routed through curry, not duplicated. Linearity is fully preserved.
- **Cartesian monoidal** = base + products (layer 2 alone): diagonal and ⊗ exist,
  but no internal hom.
- **Cartesian closed** = base + products + exponentials (all three layers): the
  full CCC, where the diagonal additionally allows x to be shared freely across
  both curry(b) and other morphisms.
