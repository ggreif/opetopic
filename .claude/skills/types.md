# Types in an Opetopic Setting (Speculative)

Working notes toward a type theory grounded in opetopic categories.
Heavily inspired by Eric Finster's *Higher Dimensional Syntax* program.
Treat as a brain dump — not yet a finished theory.

---

## Core Idea

Terms are freely constructed from a set of **morphism constructors**, whose shapes
are defined by opetopes. Each constructor lives at a specific dimension and has a
source tree that encodes its arity.

---

## The Nominal Dimension (-1)

Finster's key insight: prepend a **nominal dimension** before the opetope proper.
This occupies the empty space to the left of dimension 0 in the opetopic complex.
It acts as a **type label** — a card that names the data type.

Every opetope carrying the same nominal card belongs to that data type:
- The **nominal card alone** (dim -1): the type itself — `BT`
- **Dim 0 cells** with that card: terms of the type — `x : BT`
- **Dim 1 cells** with that card: constructors — unary, binary, ...
- **Higher cells**: rewrite rules, coherences, ...

---

## Example: Binary Trees

```
data BT where
  R : BT
  B : BT -> BT -> BT
```

The four opetopic diagrams corresponding to this definition
(from Finster's Higher Dimensional Syntax slides):

| Diagram | Opetopic shape | Meaning |
|---|---|---|
| `[BT]` alone | nominal card | the type BT itself |
| `[BT] [x]` | card + enclosed point | a term `x : BT` |
| `[BT] [x] [f] [R]` | card + term + morphism + drop | the `R` leaf constructor |
| `[BT] [[x][f]] [[f][f]] [B]` | card + two terms + binary node | the `B` branch constructor |

The **source tree shape** of the constructor cell directly encodes its arity:
- `R` — nullary (drop/lollipop, no inputs)
- `B` — binary (two input wires, triangle shape in the geometric picture)

---

## Types, Terms, Constructors

- **Types** = nominal cards (dimension -1): classify everything above them
- **Type constructors** = cells whose source tree is over the nominal card
- **Data constructors** = cells that build terms: their shape (unary, binary, ...)
  is the arity of the constructor
- **Terms** = 0-cells tagged with a nominal card
- **Rewrites / proofs** = higher cells

This gives a natural hierarchy matching dependent type theory:

| Dimension | Role |
|---|---|
| -1 | Type (nominal card) |
| 0 | Term |
| 1 | Morphism between terms / constructor |
| 2 | Rewrite / proof |
| n ≥ 3 | Higher coherence |

---

## Term Construction = Opetopic Composition

A concrete term of type BT is displayed as an opetopic **composite** — enclosed in
a red box with a single output wire at the bottom. Example from Finster's slides,
representing `B(R, B(R, R))`:

```mermaid
graph BT
  R1([R]) --> B2([B])
  R2([R]) --> B2
  R3([R]) --> B1([B])
  B2      --> B1
```

A branch whose left child is a leaf and whose right child is another branch with
two leaves. Reading the diagram:

- Leaves = `R` nodes (nullary, drops — no input wires)
- Internal nodes = `B` nodes (binary — two input wires each)
- The red enclosing box = **opetopic composition**, collapsing the tree of
  constructor applications into a single output cell

The tree structure of the term *is* the source tree of the composite. There is no
separate "evaluation" step — the term and its opetopic shape are the same thing.

The left diagram `[BT] [x] [f]` is the *general schema* for a term; the red box
is a *specific composite* — a particular inhabitant built by applying constructors.

---

## To Be Developed

- Dependent types: how does the nominal card generalise to families?
- Connection to the CCC/lambda structure in `lambdas.md`
- Finster's full treatment of type formers (Π, Σ, Id) in this setting
- Links to specific Finster talks/papers
