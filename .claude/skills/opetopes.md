# Opetopes — Intuition & Construction

## What is an Opetope?

An opetope is a multi-dimensional cell, analogous to faces in a simplicial complex (triangles, tetrahedra, ...) but without those intuitive geometric shapes. The higher-dimensional analogs of trees are the shapes — specifically, opetopes are the "well-behaved" ones among all possible higher-dimensional trees.

An opetope is a sequence of **atomic diagrams** connected by **bonds**:

```mermaid
flowchart LR
  F1([AtomicDiagram 1]) --- F2([AtomicDiagram 2]) --- F3([AtomicDiagram 3]) --- dots[...]
```

Each atomic diagram is one `AtomicDiagramView` in the UI (Finster calls them AtomicDiagrams). Only one is in view at a time; little arrows navigate between them.

The **bond**: *the boxes of one diagram are in bijection with the edges of the next.*

---

## Two Views of the Same Tree

Every rooted tree has two equivalent depictions:

- **Box tree** ("from above"): nested rectangles, containment = tree structure.
- **Edge tree** ("from the side"): nodes and edges as a graph.

These are projections of the same object in a higher-dimensional space. The grey leaf-boxes play a dual role: simultaneously leaves of the box tree *and* nodes of the edge tree.

---

## Atomic Diagrams — Well-Formedness Rules

1. The interior of every box is a **non-empty connected subtree** of the edge tree.
2. Both trees are **rooted** (there is a largest enclosing box; there is a root edge).

**Consequence of rule 2:** dimension 0 cannot appear in Focus — it has no box tree structure that can be rooted over a substrate. Dimension 0 lives in **Prev** (empty substrate), and Focus begins at dimension 1.

---

## The Three-Pane Editor

| Pane | Content | Editable? |
|---|---|---|
| **Prev** | substrate edge tree as `BoxDiagram` | right-click leaf → source extrude |
| **Focus** | `AtomicDiagramView` — disks over substrate | double-click edge → drop insert |
| **Succ** | `TreeDiagram` only — no disks | read-only |

Disks exist only in Focus/Prev. Succ is a pure tree.

---

## Focus → Succ: The Side-View Transformation

Disk nesting in Focus viewed **from above** — like **Towers of Hanoi**:

```
 ___________
(   _____   )
(  (  ·  )  )
(  (_____)  )
(___________)
```

Look at the same nesting **from the side** — two horizontal sticks, one above the other:

```
 ———————

 ———————
```

Rotate each 90° around its own center until they touch. Their meeting point **is** the new node:

```
|
·
|
```

More/deeper nesting → more branches and height in Succ.

---

## The Data Structure

```typescript
// Global ID supply — unique across the entire opetope, SVG elements,
// and force-layout constraint anchors. TypeScript is not dependently typed,
// so cross-tree ID contracts are runtime-only; global uniqueness is the foundation.
let _nextId = 0
function freshId(): string { return String(_nextId++) }

type Drop = {
  dropId: string     // globally unique primary key — bonds to lollipop in Succ
}

type Tree = {
  away:     Set<string>        // SET of substrate branch IDs this disk avoids
  drops:    Drop[]             // drops on THIS node's outgoing branch (stem for root;
  //                           //   branch to parent for all others)
  children: [string, Tree][] | null
  //         ^ branch ID
  //  null = open leaf;  [] = nullary corolla
}

// under() is always computed, never stored
function under(substrate: Tree | null): Set<string> {
  if (substrate === null) return new Set()  // dim 0: empty substrate
  return allBranchIds(substrate)
}

// support = under(substrate) \ disk.away
function support(disk: Tree, substrate: Tree | null): Set<string> {
  const u = under(substrate)
  return new Set([...u].filter(id => !disk.away.has(id)))
}

type Opetope = Tree[]   // length n for an n-dimensional opetope
```

- `away` and `under()` are **sets** (`Set<string>`), not arrays.
- There is **no `cell` field** — disk identity is the `string` given by the parent. Labels and dims are orthogonal (separate map).
- Branch IDs must be **globally unique** within the opetope — enforced via `freshId()`. This also provides stable IDs for SVG elements and force-layout constraints.
- The substrate of `Tree[i]` is `Tree[i-1]`; `away` values reference branch IDs from there.
- An **opetope** is `Tree[]` of length `n` for an n-dimensional opetope.

### Soundness rules (checked at runtime)

For each disk, let `support = under \ away`:

0. **Connectivity** — `support` must be a connected subtree of the substrate tree. Since every tree has a unique path between any two nodes, the rule is: for every pair of nodes `u, v ∈ support`, every node on the unique path `u → v` must also be in `support`. Any node on the path that is in `away` makes the disk invalid.

For siblings in any `children` array, let `under` = parent's straddled set:

1. `away_i` must be **mutually unequal** (no two sibling disks are the same disk)
2. Straddled sets `(under \ away_i)` must be **pairwise disjoint**
3. `away ≠ []` unless `under = []` (no disk may cover its entire parent unless the substrate is empty)
4. At least one inner disk required (no bare-stick Succ with no nodes)

Rule 3 permits the globular case: when `under = {}` at every level, `away = []` is forced, giving the self-similar chain.

**Soundness rule 5 — Away-disjointness (parent vs. children)**:

For any node with children, the node's own `away` set must be disjoint from the union of its children's `away` sets:

```
node.away  ∩  ⋃ child.away  =  ∅
```

**Grounding**: `away` entries are resource-like — a substrate branch ID can only be excluded once on any root-to-leaf path. If a parent already marks a branch as avoided, that branch is already outside the parent's support; a child cannot also mark it as avoided (it would be excluding something already excluded, a double-removal from a set-like resource). Encircle enforces this by moving `away` from the child up to the new wrapper and setting the child's `away` to `∅`.

Rule 1 in action: in dimension 0, `under = {}`. Two sibling inner disks would both have `away = []` — equal — violation. Hence no branching at dimension 0 without substrate nodes to differentiate siblings.

### Drops

A **drop** is parasitic on an edge of the edge tree. Every node has exactly one outgoing branch (its stem for the root, or the branch leading up to its parent for all others). Drops on that branch are stored directly on the node as `drops: Drop[]`. The `dropId` bonds to a lollipop (`children: []`) in Succ. Drops do not appear in globular complexes.

---

## Termination: The Corolla Condition

An opetope is **complete** when the Succ of the rightmost AtomicDiagram is a **corolla** — a single node with `0..k` input branches and one output stem.

Finster's boundary conditions:
1. **Initial** box tree is *linear* (single chain, no branching)
2. **Final** box tree is *trivial* — a corolla (one node, k leaves, no nesting)

**k=1** (globular):
```
|
·
|
```

**k=0 — nullary corolla** (from drops; not in globular complexes):
```
·
|
```

### Why the corolla is a natural dead end

A corolla has no disks. Side view: nothing to see. No sticks → nothing to rotate → no node forms → empty diagram. The construction terminates geometrically, not by rule.

---

## The Globular Complex — Simplest Opetope

Every level: substrate = `| · |`, `under = {}`, `away = []` forced. Base disk + one inner disk → `| · |` in Succ. Advance, repeat. No branching, no drops — a pure self-similar tower. All higher globs are opetopes. The 2-simplex is the *only* overlap with the simplicial world (dimension ≥ 2).

---

## Operations on Cells

### Source Extrusion
Right-click a leaf box in Prev → grows the substrate upward. A leaf becomes a corolla with one new nascent child. Animates via `nascent` field (0 → 1).

### Target Extrusion
Encloses the target in a new box, modifying the edge tree of the next dimension. Two steps: enclose target, then enclose remaining tree and add new top cell.

### Drop Insert
Double-click an edge in Focus → adds a lollipop (`children: []`) to that branch's `Drop[]`. Shown as a slashed box in Prev/Focus. Drops are degeneracies — automorphisms without bijectivity.

Currently, dropping on a bare branch (no base box) auto-creates a base box first.
This is not geometrically required — a drop can attach directly to a 0-cell, as
demonstrated by the Drop (α) in the Geometry section: α is a 2-cell whose source
tree is a single point x, with f as the output 1-cell. No intermediate 1-cell needed.

### Bare Drop (Proposed: Shift-double-click)

**Shift-double-click** on a bare branch in Focus: insert a drop anchored directly
at the 0-cell endpoint, skipping base box creation.

- In Succ: renders as a **0-ary corolla** hanging directly off the edge — single
  node, no children, one output stem
- Geometrically: a self-morphism / loop at a point — already valid in current
  opetopic theory, not an exotic extension
- In type theory: an element of the fundamental group at that point

This is a cleaner alternative to the bubble drop idea in Crackpot Corner — it stays
entirely within the existing framework. The editor just needs to stop forcing a base
box where none is required.

---

## The Head

The **head** of an opetope is the top-dimensional cell plus its codimension-1 part (lower-dimensional part notated with an ellipsis). Each cell appears *exactly twice*: once in its proper dimension, and once in the following dimension as the edge under the bond.

---

## Geometric Intuition: Thin Cells and the Vacuumed Composite

**Palm's terminology**: universal cells are called *thin* — they are "transparent",
determined entirely by their boundary, adding no new information. A thin cell
conforms to whatever shape it is pressed against, like a thin sheet of material.

**The vacuumed mattress**: a categorical composite of n-cells is a corolla frame
with the (n+1)-cell *vacuumed out* — like a vacuum-packed mattress sold flat. The
space between the base box and the input faces vanishes, making the pasting diagram
triangle almost degenerate. But not quite:

There remains an **infinitesimally thin** cell — an infinitesimal in the
non-standard analysis sense: a nilpotent field extension ε with ε² = 0. There *is*
volume, but it is not measurable, and the two configurations are categorically
indistinguishable. No functor can separate them.

The thin cell is the one whose thickness is exactly ε:
- Present, but informationally empty
- **Commutative** — it witnesses the equation but adds no content
- **Stable under commutative detours**: if one input face takes a longer but
  equivalent path, the vacuumed composite absorbs it without inflating. The
  flatness is preserved under commutative substitution.

This is why universal cells compose: the vacuum ensures the composite is uniquely
determined, and the infinitesimal remainder is the witness of that uniqueness.

### `Refl` is the smallest thin cell

`Refl` is the infinitesimal 2-cell par excellence:
- Length ε, width ε
- Area = **ε² = 0** — nilpotent, literally vanishing at the 2-dimensional level
- Present as a cell, but its 2-dimensional content is zero
- Cannot be "seen" by anything that measures area — which is exactly why it is
  the trivial path, the identity witness

The **J eliminator** then says: anything true of the ε×ε = 0 cell is true of any
thin cell — because all thin cells are categorically indistinguishable from it.
Transport along a path is the observation that ε-thick things behave like 0-thick
things for all measurable purposes.

The nilpotency ε² = 0 is not a defect — it is the *precise algebraic expression*
of why `Refl` is the base case of path induction.

---

## TODO: Stability of Target Universality (potential future chapter)

In `frontend/components/Equivalences.svelte`, the proof of "target universal ⟺ equivalence"
invokes a **stability** property via a stub link `href="#"`:

> "By stability, it suffices to consider that we are given a target universal *arrow* f."

The idea: target universality is stable under the extrusion operations, so the property
at any dimension reduces to the base case of arrows (1-dimensional cells). This is analogous
to how induction over the extrusion construction works — if the result holds for arrows,
stability propagates it to all higher dimensions.

This deserves its own chapter (likely in the `theory/` section, near UniversalProperties or
IdentitiesUnits), with a formal statement and proof. When written, the stub `href="#"` in
Equivalences.svelte should be updated to point to the new anchor.

---

## 🧨 Crackpot Corner

Speculative generalisations of opetopic theory that may or may not be tractable.
Handle with care — none of this is established mathematics.

### Bubble Drops and k-Bonds

A **standard drop** (1-bond) is dimension-adjacent:
- Attaches to an n-cell
- Boundary is an (n+1)-cell
- Lollipop appears in dim (n+2)

A **bubble drop** (2-bond) skips a dimension:
- Attaches to a 0-cell (point)
- **No** 1-cell boundary
- Boundary is a 2-cell (a surface — a bubble)
- Volume lollipop appears in dim 3

The current bond bijection requires adjacent dimensions, so a bubble drop violates
well-formedness. But geometrically nothing forbids the shape.

**Proposed generalisation: k-bonds** — bonds that skip k-1 dimensions but remain
bijective, matching n-cells to (n+k)-cells directly. Standard opetopic bonds are
1-bonds. The bijection is preserved so compositionality might survive with a coarser
grain. Finster never mentions such things, but they are geometrically conceivable.

This is reminiscent of **higher homotopy groups** — π₂ detects exactly 2-spheres
attached at a point, invisible to π₁. Standard drops only see π₁-level structure.
(Or homology, depending on taste.)

### The 0-ary Corolla and the Riemann Sphere

In the corolla condition, an n-ary corolla has n input branches venting upward.
The **0-ary case** has *no* venting holes — the top-dimensional cell sits in a
closed box with nowhere for edges to escape.

Geometrically this is the **Riemann sphere**: take a disk (the box), close off its
boundary circle to a single point (the 0-ary corolla = one-point compactification)
→ S². This is a suspension: ΣS⁰ = S¹, ΣS¹ = S², etc.

The 0-ary corolla closure *might* be admissible as a degenerate boundary case in
current opetopic theory — it is where the pasting diagram interpretation breaks
down gracefully rather than violently. (Not the Dyson sphere. The Riemann sphere.)

### Exotic Boundaries — The Torus and Beyond

Once k-bonds and non-trivial closures are allowed, the boundary of a cell need not
be a tree-shaped pasting diagram. It could be any CW-complex:
- **Torus** T² = S¹ × S¹ — requires identifications the strict bond bijection cannot express
- **Higher genus surfaces** — likewise

This moves opetopic theory toward **CW-complex** territory — cells attached along
arbitrary-dimensional boundaries — which is the natural home of homotopy theory but
much harder to work with combinatorially.

**Open question**: is the standard opetopic theory a well-behaved *slice* of
CW-complex theory, with k-bonds and exotic closures living in the larger world
outside that slice? And is that larger world tractable for higher category theory?

---

### Synthetic Analysis and the Triple Monad Collision

**Can we reformulate analysis in CT terms?** People have been working on this:

- **Synthetic Differential Geometry (SDG)** — Kock, Lawvere — axiomatises ε with
  ε² = 0 directly in a topos, recovering classical analysis without limits.
  Nilpotent infinitesimals are *objects* in the category. Lawvere's "Categorical
  Dynamics" (1967) was the opening shot.
- **Cohesive (∞,1)-toposes** — Schreiber, Shulman — combines SDG with homotopy
  type theory. Smooth ∞-groupoids have a built-in notion of smooth connectedness
  subsuming both continuity and infinitesimal structure.

**The opetopic angle**: thin cells *are* the infinitesimals. A path in a smooth
space is a thin opetopic 2-cell; smoothness is a condition on how thin cells
compose. This would give a purely opetopic synthetic analysis — no limits, no
ε-δ, just thin cells and universal properties.

**The Triple Monad Collision** — three things all called *monad*:

1. **Leibniz/non-standard monad** — the *nilpotent halo* around a real number x:
   all points infinitesimally close to x, indistinguishable by standard means.
   The cloud of ε-neighbours around a point.

2. **Category-theoretic monad** — a monoid in the category of endofunctors, with
   unit η and multiplication μ satisfying associativity and unit laws.

3. **Opetopic/substitution monad** — opetopes arise from iterated polynomial
   functors carrying a monad structure via **substitution** (grafting of trees).
   Multiplication = tree substitution: plug one tree into the leaves of another.
   This is the algebraic backbone of opetopic composition. *(Not yet discussed
   in the codebase — substitution monad is a TODO.)*

The collision is not merely nominative — deep connections lurk:
- Both substitution and the nilpotent halo are about **local structure**:
  substitution is local in the tree; the halo is local in space
- Both have a **multiplication that vanishes at second order**: ε² = 0 for the
  halo; grafting a tree of depth 2 into itself collapses at the substitution level

**Tantalising conjecture**: the nilpotent halo around a cell in a smooth opetopic
space is *computed* by the substitution monad. Smoothness = the monad structure
of opetopes acts coherently on infinitesimal neighbourhoods. The three monads are
the same monad seen from three different vantage points.

---

## Key Terms

| Term | Meaning |
|---|---|
| **AtomicDiagram** | One slice of an opetopic complex; box tree + edge tree |
| **Bond** | Bijection: boxes of one diagram ↔ edges of the next |
| **Box tree** | "From above" — nested disks; `root` in code |
| **Edge tree** | "From the side" — nodes and edges; `edgeRoot` / substrate in code |
| **Focus pane** | Active AtomicDiagram; where disks are placed over the substrate |
| **Prev pane** | Substrate (edge tree of current level = box tree of previous level) |
| **Succ pane** | Box tree of current level = edge tree of next level; no disks |
| **`away`** | Substrate node IDs a disk avoids; complement of its straddled set |
| **`under`** | Straddled set of the parent disk; always computed, never stored |
| **Corolla** | Single node with k≥0 input branches + one output stem; termination shape |
| **Drop** | Degeneracy; parasitic on a substrate child edge; lollipop in Succ |
| **Source extrusion** | Grows substrate upward at a leaf |
| **Target extrusion** | Embeds a cell in the next higher dimension |
| **Head** | Top-dimensional cell + its codimension-1 part |
| **Globular complex** | Primitive opetope; `away=[]`, `under={}` at every level; no drops |
