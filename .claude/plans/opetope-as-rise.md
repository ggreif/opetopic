# Opetopes as `Rise` — the polynomial-functor encoding

**Status:** discussion artifact, parked until a real use case surfaces.
Recorded for posterity after the 2026-05-31 arc that ran from the
hyper-rise / (γ) framing in `~/hyperfunctions/constructor/` through
to Finster's suspension/looping operation on opetopes.

## TL;DR

Opetopes can be implemented as a value-level structure *over*
the existing `Rise` substrate from `Constructor.HyperRise`, without
DependentHaskell, by pushing all the dimension-dependent shape
information into runtime data (`Inputs`/`Outputs`/`FaceData`) and
keeping the lateral profunctor type uniform (`Pt = Pt`).  This is
the polynomial-functor / slice-category lifting trick.  The price:
face coherence becomes a runtime invariant rather than a type-checked
property.  All of `Rise`, `squash`, suspension, collapse — works
unchanged at the substrate level.

## The starting tension

`Rise` (from `~/hyperfunctions/constructor/src/Constructor/HyperRise.hs`)
is the staircase abstraction:

```haskell
class Rise (r :: (Type -> Type -> Type) -> Type -> Type -> Type) where
  rise    :: r p a b -> (p a b, r p a b)
  retreat :: (p a b, r p a b) -> r p a b

data Gamma p a b = Gamma { horizontal :: p a b, vertical :: Gamma p a b }
type Γ = Gamma Hyper
```

Every rung of a `Γ a b` is a `Hyper a b` — *same* `(a, b)` at every
rung, uniform lateral type.

Opetopes, in Finster's framework, are emphatically NOT like this:

- A k-opetope's k-cells have **input/output arity** drawn from
  arrangements of (k-1)-cells.
- The "profunctor at dimension k" therefore depends on the
  structural content at dimensions 0, 1, …, k-1.
- The dependency is genuinely *iterated*: each level's shape feeds
  on accumulated user-supplied content from every level below.

If we tried to write that as a `KnownRise`-style level-aware class,
the type signature would be:

```haskell
class OpetopicRise (r :: …) where
  rise :: r (Fold F seed userData) lvl
        -> (ProfunctorAt lvl, r (Fold F seed (userData :> next)) (lvl+1))
```

— a type-level fold over a dependent type-level cons-list, with two
inputs per step.  This sits squarely in **DependentHaskell** or
Agda/Lean territory.  Plain GHC can't express it: closed type families
parameterised by user-extensible data of varying kind at varying level
isn't a thing.

So the naive attempt is: opetopes are *strictly more dependent* than
our `(γ)`.  Our (γ) is the trivially-uniform fold; opetopes are the
genuinely-dependent fold.

## The polynomial-functor way out

The classical CS dodge for "I want dependent indexing but my host
language doesn't have it": **encode the dependency at the value
level**.  Specifically, do the polynomial-functor / slice-category
lifting:

- Pick a uniform base type (here `Pt`, the "name of opetope" at
  dim -1).
- Build runtime data (`Inputs`, `Outputs`, `FaceData`) that captures
  the dimensional structure.
- Push all the "what does dimension k look like" information into
  *values* of the rung type, not into the rung type itself.
- The host language sees a uniform `Rise` substrate; the opetopic
  structure rides in the values.

This is the slice-category lifting: instead of working in `Set`
chasing dependent kinds, work in `Set/B` for `B = FaceData`, and the
slice-fibration is what `Hyper Pt Pt`'s value-level body now encodes
per rung.

It's also exactly how the actual opetopic engines (Finster's
Opetopic, sctt, etc.) work in practice — they don't try to type-
encode the dependency directly; they work in a substrate with runtime
polynomial-functor data and (when needed) *external* coherence proofs.

## The encoding

```haskell
-- Runtime carriers of opetopic shape
data Inputs   = Inputs  { … }   -- arity / source faces at this dim
data Outputs  = Outputs { … }   -- target face at this dim
data FaceData = FaceData
  { dim       :: !Int
  , inputs    :: !Inputs
  , outputs   :: !Outputs
  , attached  :: …               -- references into lower dims by path
  }

-- Uniform lateral type — the nominal "Pt" of dim -1
data Pt = Pt { name :: !Text, … }

-- Rise substrate, untouched
type Opetope = Γ Pt Pt          -- i.e. Gamma Hyper Pt Pt
```

Each rung's `Hyper Pt Pt` carries the level's `FaceData` as part of
its hyperfunction body.  The dimensional ladder rides as a runtime
tree:

| level k | `horizontal :: Hyper Pt Pt` contains                              |
|---------|-------------------------------------------------------------------|
| -1      | nominal token — "this opetope is named X"                         |
| 0       | the points (0-cells) of X                                         |
| 1       | edges with `Inputs`/`Outputs` referencing level 0's points        |
| 2       | 2-cells with `Inputs`/`Outputs` referencing level 1's edges       |
| k       | k-cells with `Inputs`/`Outputs` referencing level (k-1)'s cells   |

The dependency that *was* type-level (each level's profunctor depending
on the previous level's structure) is now **value-level**: each
rung's `FaceData` references the lower rungs by index/path into the
same column.  The base type `Pt` stays uniform; `Rise` doesn't even
know it's hosting an opetope.

## Trade-offs (the price of slice-lifting)

1. **No typechecker enforcement of face coherence.**  The constraint
   "level k's `Inputs` must reference well-formed level (k-1) faces"
   becomes a *runtime* invariant.  You can construct ill-typed
   opetopes; you just get garbage (or a clear error from a
   `validateOpetope` pass) downstream.

2. **Smart constructors needed.**  The user-supplied per-dimension
   content flows through builder functions that maintain coherence:

   ```haskell
   emptyOpetope :: Pt -> Opetope                          -- dim -1 only
   addDim       :: Opetope -> Inputs -> Outputs -> Opetope
   ```

   The "iterated type-level fold" of the dependent encoding becomes
   an iterated *value-level* builder.

3. **`squash` / `suspend` / `collapse` reuse `Rise`'s versions
   verbatim.**  Suspension on opetopes becomes suspension on the
   underlying `Γ Pt Pt`.  The Finster operation
   "prefix-becomes-points" reads as: take the n bottom rungs of
   `FaceData`, project their content into a new `Pt'` token via a
   value-level fold, build a new tower whose dim-(-1) name is `Pt'`.
   All of it runtime, all of it on the existing `Rise` substrate.

4. **No `KnownRise` required.**  The level info lives in `FaceData`'s
   tree structure (the `dim` field, the path references), not in
   types.  Plain `Rise` is enough.

## What suspension/looping actually does, under this encoding

Recall the corrected Finster reading (per the 2026-05-31 conversation):
opetopic suspension is *dimensional re-rooting*, not rung-fusion.
The bottom n rungs don't *collapse* into one rung; they get
*reinterpreted as the new ground floor*, and the suffix becomes the
tower sitting over that re-rooted base.

In this encoding:

```haskell
suspendBy :: Int -> Opetope -> Opetope
suspendBy n op =
  let (prefix, rest) = squashFirst n op   -- standard Rise squash
      newPt          = bundlePrefix prefix -- value-level fold into a new Pt token
      reBased        = reBase newPt rest   -- rest's dim-k cells become dim-(k-n) cells over newPt
  in  prependPt newPt reBased
```

The "type thickening" of `(a, b)` into `(a', b')` that I sketched
yesterday becomes here a *value-level* re-tokenisation: a new `Pt`
value is constructed that bundles the prefix's content, and the
remaining tower is re-based over that new token.  No type-level
acrobatics.

`bundlePrefix` is the polynomial-functor fold over the prefix
`FaceData` — itself a slice operation, but at the value level.

## Where this connects to existing work

### `~/hyperfunctions/constructor/`

- `Constructor.HyperRise` — the substrate; reused unchanged.
- `Constructor.Tower` — `type Tower = Γ TyView TyView`, a concrete
  instance for type-checking.  An opetopic instance would be
  `type Opetope = Γ Pt Pt`, a *parallel* concrete instance for
  opetopic content.
- `Constructor.LevelInfer` — the *trivially-uniform* fold (every
  level: just lift via `kindOf`).  Opetopes need a genuinely
  non-uniform fold that's still value-level (smart constructors).

### `~/opetopic/`

This is the home for the runtime opetopic apparatus.  When a use
case lands, the implementation path is:

1. `Opetopic.Polynomial` — `Inputs`/`Outputs`/`FaceData` and the
   slice-category builders.
2. `Opetopic.Engine` — operations on `Γ Pt Pt` opetopes
   (composition, gluing, the BMM tree calculus).
3. `Opetopic.Suspension` — the dimensional re-rooting operation as
   sketched above, expressed via `squash` + value-level fold +
   re-base.
4. `Opetopic.Coherence` — runtime validator for face-data
   well-formedness (the invariant the type system would otherwise
   enforce).

The substrate (`HyperRise`) doesn't need to know about any of this.

## Three regimes summarised

| regime                  | structure                              | host language     |
|-------------------------|----------------------------------------|-------------------|
| **Bare `Γ`**            | uniform substrate, no opetopic content | plain GHC         |
| **Opetopes-over-`Γ`**   | same substrate, `FaceData` in values   | plain GHC         |
| **Dependent opetopes**  | type-level shape per dimension         | DependentHaskell / Agda / Lean |

The middle row is what this document describes.  Strictly weaker
guarantees than the third row, but *executable today* in our Haskell
substrate.

## Why this matters

The 2026-05-31 conversation kept circling whether opetopes were
"compatible" with our (γ)/`Rise` framework or whether they required
strictly more apparatus.  The answer is: they're compatible **via the
slice-lifting trick**, at the cost of runtime coherence.  If/when an
opetopic engine becomes useful (whether for typecheck-of-typecheck
work, for higher-categorical computation, or for an HoTT-style
substrate), the implementation path is clear and the substrate
already exists.

The conceptual move — "push dependent shape into runtime data;
keep the substrate uniform" — is the same trick that:

- Lets GADTs be encoded as plain ADTs + runtime tags
- Lets HOAS be encoded as runtime trees
- Lets Agda's universe polymorphism be implemented as data-kind
  rather than primitively
- Lets `LevelInfer` in the constructor work over plain GHC

So this isn't a special opetopes-only dodge.  It's the same
"compile dependent types to value-level structure" move applied
to the opetopic case.

## References / context

- The `38d9ed6` git-note in `~/hyperfunctions` (calling convention
  as (γ)) — the framing that surfaced suspension and squash.
- `~/hyperfunctions/constructor/PLAN.md` — "Hyper-rise" section
  (current source of truth on `Rise` / `Gamma` / `Γ`); "Absolute
  version: `KnownRise`" subsection (the level-aware refinement, also
  parked).
- Finster's video on opetopic suspension/looping
  (https://youtu.be/aPBqf72X-I8?si=4KhDpijfVJDqaMtm&t=2196) — the
  "prefix-becomes-points" framing that prompted this writeup.
- Berger-Moerdijk-Weiss tree calculus / polynomial functors — the
  classical apparatus behind the slice-lifting move.
