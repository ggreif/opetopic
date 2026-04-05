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

## To Be Developed

- Dependent types: how does the nominal card generalise to families?
- Connection to the CCC/lambda structure in `lambdas.md`
- Finster's full treatment of type formers (Π, Σ, Id) in this setting
- Links to specific Finster talks/papers
