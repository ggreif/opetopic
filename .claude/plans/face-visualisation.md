# Plan: D3-based Opetope Builder & Visualizer

**Branch:** `d3` — all work goes here.

---

## Conceptual model

An **atomic diagram** = a pair (box tree, edge tree). These are two views of the same data:
- **Box tree** (`root`): nested rectangles = "from above", shows containment structure
- **Edge tree** (`edgeRoot`): rooted tree = "from the side", shows corolla/branching structure
- The **bond** between adjacent diagrams is the isomorphism between the box tree of diagram n and the edge tree of diagram n+1 — this is shown by the matching labels (box label `a` ↔ tree branch `a`)

Both views are of the **n-th dimensional faces** (n > 0; lower dimensions admit only trivial trees). No color-coding by dimension is needed.

### Key insight: visual dimension reduction (boxes → tree)

| Boxes pane | Tree pane |
|---|---|
| Area (rectangle, e.g. `c`) | **Edge** (the line leading to `c`'s open tip) |
| "Outer" / container box (e.g. `g`, `j`) | **Corolla node** (dot with branches) |
| Leaf box (open input, no sub-boxes) | **Open branch tip** — no dot, just an open end |
| Imaginary z-direction connection between boxes | **Node** (dot) in the tree |

The tree pane is a **dimension-reduced view**: what appears as a 2D area in the boxes pane is just a 1D edge in the tree pane. The nodes (dots) in the tree correspond to imaginary connections — they are not labeled and are only drawn for **internal nodes** (corollas). Leaf nodes are open branch ends and get no dot.

This reduction is the key to inductively "seeing" n-dimensional opetopic faces: the prev pane (n-1 faces) provides the substrate that the focus (boxes) enboxes following opetopic rules. By iterating this, one can work one's way up to arbitrary dimensions.

### Pane semantics (current)
- **Focus pane ("boxes")**: `BoxDiagram` of `focus.root` — nested rectangles
- **Succ pane ("tree")**: `TreeDiagram` of `focus.edgeRoot` — corolla tree, root at bottom

### Pane semantics (future — do NOT implement yet)
- **Prev pane**: will show the `n-1` dimensional faces. The current _boxes_ view (focus) will use that substrate to "enbox" its parts adhering to the opetopic rules.
  - Once prev is added back, focus becomes the middle pane and shows the bond between prev and succ.

### Corolla visual convention
```
│     │     │       ← input branches (open tips, no dot — leaf boxes are open inputs)
╰──∙──╯             ← bus AT the dot; rounded arc ends (╰ ╯); T-junctions for middle inputs
      │             ← output stem (same length as one branch step)
```
- The bus is at the **same y as the dot** — horizontal lines originate from the dot
- **Labels on edges, not nodes**: each cell label sits at the midpoint of the edge leading
  to that cell's dot; the root label sits at the midpoint of the output stem
- **Dots only at corolla nodes** (internal nodes with children); leaf nodes = open branch tips, no dot
- The **output stem** is an "incoming" branch — conceptually composable with another
  corolla's outgoing (input) edges. Same length as one ascending branch step.
- A **nullary corolla** has only the output stem (a lollipop) — the stem is not special
- No arrowheads; uniform node color (no dim-based coloring)
- Custom layout (not vanilla `d3.tree()`): odd-count parent placed above its **middle child**
  so the middle T-junction lands exactly on the dot; even-count at midpoint of range

---

## Data model (`frontend/lib/opetope.ts`) ✅

```typescript
type Cell = { id: string; label: string; dim: number }
type Tree = { cell: Cell; children: [string, Tree][] }
type AtomicDiagram = { root: Tree; edgeRoot: Tree }
```

Examples implemented: `point()`, `arrow()`, `simplex()`, `boxtree()`

**`boxtree()`** — from `boxtree.svg`:
```
j { g { a, b, c }, i { t }, u { d, e } }
```
j = outermost box = tree root (dim 2); g/i/u = dim 1; a/b/c/t/d/e = dim 0 (leaves)

---

## Components

### `frontend/components/BoxDiagram.svelte` ✅
- Props: `tree: Tree`, `width`, `height`
- Recursive layout: leaves = 64×44px fixed; parents sized to contain children
- Children arranged left-to-right with H_GAP=10, H_PAD=12, V_PAD_TOP=26
- Labels: italic serif, top-right corner inside each box
- No color-coding

### `frontend/components/TreeDiagram.svelte` ✅
- Props: `tree: Tree`, `width`, `height`, `oncellclick?`
- Custom layout (not vanilla d3.tree): leaves uniform; internal nodes above middle child (odd)
  or midpoint of leftmost/rightmost child (even); y by depth; root at bottom
- TREE_H=88px total span; output stem = TREE_H/maxDepth (one branch step), centered in SVG
- Bus at dot level (busY = py): rounded arc ends (ARC_R=6), T-junctions for middle children
- Single child: straight vertical from dot to child
- Dots only at corolla nodes (internal); leaf nodes are open branch tips — no dot
- Labels on edges (midpoint of vertical to child; root label on output stem midpoint)
- SVG `overflow: visible` — labels near edges are not clipped
- No color-coding, no arrowheads

### `frontend/components/OpetopeEditor.svelte` ✅
- Two panes: **boxes** (BoxDiagram of focus.root) + **tree** (TreeDiagram of focus.edgeRoot)
- Prev pane removed for now (will return for `n-1` dimensional faces)

### `frontend/components/OpetopeBuilder.svelte` ✅
- Default example: `boxtree()`
- Toolbar: Boxtree, Simplex, Arrow, Point
- Lives at top of `App.svelte` (editor first, docs below)

### `frontend/components/OpetopeDiagram.svelte` (retained but unused in editor)
- Original WebCola force-directed renderer; kept for reference

---

## Roadmap

### Phase 1 — rendering ✅
- `opetope.ts` data model + `toGraph()`
- `BoxDiagram.svelte` (nested rectangles)
- `TreeDiagram.svelte` (corolla tree, `d3.tree()`)
- `OpetopeEditor.svelte` two-pane layout
- `OpetopeBuilder.svelte` with example gallery

### Phase 2 — navigation (next)
- Click a cell in the tree pane → navigate the opetopic complex
- Clicking a cell in `focus` makes it new focus; old focus becomes `succ`, source becomes `prev`
- Prev pane restored showing `n-1` dimensional faces

### Phase 3 — builder interactions (future)
- Add-cell toolbar (dimension selector + label)
- Click to add 0-cell or 1-cell to focus diagram
- Drag to connect two 0-cells as a 1-cell

---

## Known issues / iteration points
- BoxDiagram labels sit top-right inside each box; may want to experiment with placement
