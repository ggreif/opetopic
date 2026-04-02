# Edge Tree Layout Strategy

## Coordinate system

SVG y increases **downward**. The tree is rendered **upside-down** relative to the usual "root at top" convention:

```
y = small  →  leaves (TOP of SVG)
y = large  →  root   (BOTTOM of SVG)
```

A node's parent is always at **larger y** (below it on screen). A node's children are at **smaller y** (above it). The output stem hangs below the root.

---

## Phase 1 — x positions (leaves evenly, parents at midpoint)

Leaves get x positions uniformly spread across `innerW = (width - 2*PAD) * 0.9`. Parent x is the median (odd children) or midpoint of the two outermost children (even children). Computed bottom-up via `eachAfter`.

---

## Phase 2 — y positions by depth

```
stemLen = TREE_H / maxDepth          // vertical pitch between depth levels
topOff  = (height - TREE_H - stemLen) / 2
node.y  = topOff + TREE_H - (depth / maxDepth) * TREE_H
```

All nodes at the same depth land on the same y. The root is at `topOff + TREE_H`; leaves are at `topOff`. `stemLen` is stored as `root._stemLen` for use by the renderer.

---

## Phase 3 — Drop correction (BEFORE nascent, top-down)

Each node has a **k** drops stored on its outgoing branch. Those k drop boxes are placed **below** the node (into the branch toward the parent / stem), stacked at:

```
box i top  = nodeY + DROP_SPACER + i * DROP_UNIT
box i bot  = nodeY + DROP_SPACER + i * DROP_UNIT + DROP_BOX_H
```

where `DROP_UNIT = DROP_BOX_H + DROP_SPACER = 20`, `DROP_BOX_H = 16`, `DROP_SPACER = 4`.

For all k boxes to fit before the parent arc:

```
needed = DROP_SPACER + k * DROP_UNIT + DROP_BOX_H   // = (k+1) * DROP_UNIT
```

**Non-root nodes** (`eachBefore`, top-down so parent positions are already set):
```
vertBot = parent.y − ARC_R
maxY    = vertBot − needed
if node.y > maxY:
    shift = node.y − maxY
    lift node AND its entire subtree by shift   (d.each: n.y −= shift)
```
Processing top-down means if a parent was lifted, its children moved with it, and their own corrections are computed relative to the new (already lifted) parent position.

**Root node** (no parent — outgoing branch is the stem):
```
neededStem = DROP_SPACER + rootK * DROP_UNIT + DROP_BOX_H
if stemLen < neededStem:
    ext = neededStem − stemLen
    lift entire tree by ext   (root.each: n.y −= ext)
    root._stemLen = neededStem
```
Lifting the whole tree effectively grows the stem downward within the SVG viewport.

---

## Phase 4 — Nascent adjustment (AFTER drop correction)

Source extrusion animates a new child from 0 → 1 via `cell.nascent`. At each animation tick, the child's position is interpolated from its parent toward its natural layout position:

```
child.x = parent.x + nascent * (child.x − parent.x)
child.y = parent.y + nascent * (child.y − parent.y)
```

This must run **after** the drop correction so the child interpolates toward the already-lifted parent, not the pre-correction position.

---

## Frame rect

The base `frameRect` is derived from tree coordinates:

- **top**: `leafY + stemLen/4` — leaves poke above by `stemLen/4` (symmetric with bottom)
- **bottom**: `rootY + stemLen * 3/4` — stem pokes below by `stemLen/4`
- **left/right**: `min/max leaf x ± H_PAD_L/R`

`adjustedFrameRect` then expands the frame to cover all drop boxes in both directions:

- **Upward**: if any `dropLayout.rect.y < fr.y`, set `newTop = minRectY − DROP_SPACER`
- **Downward**: if any `dropLayout.rect.y + h > fr.y + fr.h`, set `newBot = maxRectBottom + DROP_SPACER`

This is symmetric: child-branch drops push the top up; stem drops push the bottom down.

## Leaf tip extensions

After `adjustedFrameRect` is computed, a `leafCeiling = adjustedFrameRect.y − DROP_SPACER` is derived. Every leaf node whose `y > leafCeiling` gets a vertical extension path drawn from `nodeY` up to `leafCeiling`. This keeps all branch tips flush with the top of the frame regardless of how much any one branch was lifted by its drops. These extensions carry full hover and droppable behavior.

---

## Node shapes

Every node in an edge tree is a **16×16 roundrect** (`rx=3`). This is the single visual vocabulary for all node kinds:

| Kind | `children` value | Shape |
|---|---|---|
| Open leaf (input branch tip) | `null` | no node rendered |
| Lollipop (nullary corolla) | `[]` | 16×16 roundrect |
| Inner node (corolla with inputs) | `[…]` | 16×16 roundrect |

The `nullary` flag in the hierarchy data distinguishes lollipops from open leaves (both have no d3 children, but only lollipops get a node rendered). This invariant holds across **all** edge-tree renderers.

---

## `intermediateBoxes` — critical implementation details

Computed as a `$derived` in `AtomicDiagramView`. Renders wrapper disks added by `encircle` as
nested box-rects in Focus. Four invariants that must be preserved:

1. **Lollipop guard**: bail on `t.children === null || t.children.length === 0`. Without the
   `length === 0` check, drops (lollipops in `focus.root`) produce spurious intermediate boxes.

2. **Post-order traversal**: recurse into children *before* computing the parent bounding rect.
   Pre-order breaks at depth ≥ 2 because the child's extent hasn't been registered yet.

3. **`extMap` stores half-extents `{cx, cy, hw, hh}`**, not just centers. Using a fixed
   `hw = hh = DROP_BOX_H/2` for all levels makes every encircling produce an identical-sized
   rect. Seed with:
   - Edge-tree nodes: `hw = hh = DROP_BOX_H/2`
   - Drop rects: `hw = dr.w/2, hh = dr.h/2`
   - Each computed intermediate box: `hw = ib.w/2, hh = ib.h/2` (registered post-order)

4. **Direct children only**: use `t.children.map(([,c]) => extMap.get(c.cell.id))`, NOT a
   recursive `leafIds()` walk. Recursing to leaves makes all nesting levels collapse to the
   same innermost positions.

### Known visual issue (pending fix)

The current layout is functional but messy — nested intermediate boxes overlap and don't push
surrounding nodes away. Proper layout requires the edge-tree positions to be adjusted so that
encircled groups have real estate: either expand `computeLayout` to account for wrapper sizes,
or use a constraint-based approach (see Constraints section below).

---

## Succ interactivity — both pending dimension hopping

### Node hover sensitivity

Nodes in the Succ `TreeDiagram` currently have **no hover sensitivity** (`onmouseenter`/`onmouseleave` removed). Succ nodes bond rightward (to the next dimension), which is not yet accessible.

When **dimension hopping** (◀▶ navigation between atomic diagrams) is implemented, Succ nodes must gain hover sensitivity: hovering a Succ node should highlight the corresponding **base disk** in the next Focus pane to the right — the same pattern as Focus node → Succ stem, one level up. At that point, restore `onmouseenter`/`onmouseleave` on the `TreeDiagram` node rects and wire them through a `onnodehover` prop (mirroring the `AtomicDiagramView` pattern).

### Drop insertion on Succ branches

Succ branches also cannot yet receive drops. The reason is structural: a drop on a Succ branch would require a lollipop in `succ.root` (the next atomic diagram's box tree), and that diagram does not exist yet — there is no `succ.tree` to hold it and assign it a fresh id.

When dimension hopping lands and `succ.tree` is accessible, enable `ondropinsert` on the Succ `TreeDiagram` (currently passed as `drops={[]}` and no `ondropinsert`). The handler follows the same pattern as `handleDropInsert` in `OpetopeBuilder`, operating one level to the right.

---

## Shared concept: EdgeTreeView

`TreeDiagram` (Succ pane) and the tree layer of `AtomicDiagramView` (Focus pane) both render edge trees using the same logic: `buildHier`, `computeLayout`, `corollaElements`, node roundrects, branch paths, hover/click wiring. They are the **same concept**.

Planned refactor: extract a shared `EdgeTreeView` component. `TreeDiagram` becomes a thin wrapper; `AtomicDiagramView` composes `EdgeTreeView` + the box layer.

---

## Real-estate plan: VPSC-based constraint layout

### Library choice: WebCola's VPSC solver (already bundled)

**d3-force** is wrong: iterative/async, no hard constraint guarantees, cannot enforce strict upside-down tree topology or box containment. **Dagre** handles sibling separation but not containment groups. **ELK** (WASM) is excellent but adds 2MB, async API, and breaks Svelte's synchronous reactive pipeline.

**WebCola's VPSC layer** (`Solver`, `Variable`, `Constraint` from `webcola/dist/src/vpsc`) is already in the bundle (used by `toGraph()` in `opetope.ts`). It is **synchronous**, runs in O(n log n), and solves to a global optimum for convex constraint sets — making it a drop-in inside a `$derived`.

### New pipeline: `computeLayout2` (single pure function)

Replaces the current split between `computeLayout` + `intermediateBoxes` + `dropLayout`:

```
Pass A — measure minimum spans (post-order walk of focus.root box tree)
Pass B — assign desired leaf x via recursive measure+place (like BoxDiagram)
Pass C — VPSC x-axis pass (enforce sibling separation + box containment)
Pass D — y by depth + drop correction (existing logic, largely unchanged)
Pass E — derive intermediateBoxes from VPSC-solved node positions
Pass F — nascent lerp (runs last, as today)
```

Returns a single `LayoutResult` used by the SVG template — no template changes needed.

### Constraint vocabulary

| Constraint | Expression |
|---|---|
| Sibling separation | `right.x − left.x ≥ NODE_W + H_GAP` |
| Box containment | innermost pair: `c_n.x − c_0.x ≥ 2*INTER_PAD + NODE_W`; nested boxes cascade naturally |
| Drop width | `MIN_SEP = max(NODE_W, DROP_W) + H_GAP` for nodes with drops |
| Tree topology (parent x = median) | Soft constraint — high-weight desired position, not hard |
| Straight vertical branches | Structural guarantee — x set once per node, branch paths recomputed from solved positions |
| Drop stacking (y-axis) | Existing `eachBefore` lift logic unchanged |

**Key insight**: box bounds are derived functions (`box_left = leftmost_descendant.x − INTER_PAD`), not independent VPSC variables. Only tree node x positions are variables. This keeps the constraint system small.

### New file: `frontend/lib/layout.ts`

Extracts `computeConstrainedLayout(edgeRoot, root, drops, svgW, svgH): LayoutResult` as a pure, independently testable module. Both `AtomicDiagramView` and `TreeDiagram` import from it.

### Migration steps

1. Extract current `computeLayout` into `frontend/lib/layout.ts` (no behaviour change)
2. Add `measureMinSpans(root: Tree): Map<string, number>` to `opetope.ts`
3. Replace Phase 1 equal-interval with recursive measure+place
4. Add VPSC x-pass after desired positions are set
5. Move `intermediateBoxes` derivation inside `computeLayout2` (feeds from VPSC-solved coords)
6. Port x-VPSC to `TreeDiagram` (sibling separation only — no boxes)
7. Optional: y-VPSC if multi-depth encircled groups cause vertical overlaps

---

## Layout constraints (not yet implemented)

### Constraint 1 — Optical centering

The **optical center** of each pane's diagram (the center of its bounding box) must coincide with the **geometric center** of its pane. All three pane centers should lie on the same horizontal line.

Consequences:
- `computeLayout` must produce coordinates such that `(diagramBBoxLeft + diagramBBoxRight) / 2 = paneWidth / 2` and `(diagramBBoxTop + diagramBBoxBottom) / 2 = paneHeight / 2`.
- Currently `topOff = (height - TREE_H - stemLen) / 2` only centers the tree's y range, not the full bounding box (which includes the frame and drop boxes). The correct centering must use `adjustedFrameRect` as the bounding box, so it must be a two-pass computation: lay out → compute bbox → shift everything to center the bbox.
- The x centering is similarly off: `innerW` is fixed at `(width - 2*PAD) * 0.9`, but the frame left/right may not be centered in the SVG width.

### Constraint 2 — Minimum margin and auto-scaling

Each pane has a **minimum margin** `PANE_MARGIN` on all four sides. When the diagram's bounding box (after centering) would violate these margins, the diagram must **scale down uniformly** until it fits.

Concretely: after the two-pass centering, if `bboxW > paneWidth - 2*PANE_MARGIN` or `bboxH > paneHeight - 2*PANE_MARGIN`, compute:
```
scale = min(
  (paneWidth  - 2*PANE_MARGIN) / bboxW,
  (paneHeight - 2*PANE_MARGIN) / bboxH
)
```
and apply an SVG `transform="scale(scale)"` (around the bbox center, or equivalently translate → scale → translate back). This is an SVG-level transform; the coordinate values in `computeLayout` do not change.

Both constraints apply to all three panes (Prev `BoxDiagram`, Focus `AtomicDiagramView`, Succ `TreeDiagram`) independently.

---

## Why root is different

The root's outgoing branch is the **stem** (going downward), not a branch toward a parent node. There is no `d.parent` in the d3 hierarchy, so the non-root correction cannot apply. Instead, the stem is lengthened and the tree is shifted upward uniformly. The visual effect is the same — more space for drop boxes — but the mechanism is different because the stem length is a derived constant (`_stemLen`) rather than an implicit distance to a parent node.

**Ideal future fix**: unify both cases by treating the stem as a virtual parent at `rootY + stemLen`, so the same formula `maxY = virtualParent.y − ARC_R − needed` can be used for all nodes. This would eliminate the root special-case.
