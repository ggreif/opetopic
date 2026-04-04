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

## Phase 3 — Clearance correction (BEFORE nascent, top-down)

Each node has a **fence** — the minimum unobstructed space it claims around itself. The layouter enforces two fence constraints for every non-root node relative to its parent:

1. **Downward**: the node's bottom extent (drop stack or tower bottom) must clear the parent's top fence edge.
2. **Upward**: the node's own top must clear the parent's tower top (when the parent is wrapped).

Both are enforced in a single `eachBefore` (top-down) pass so parent lifts propagate before children are corrected.

### Drop box rendering

Drop boxes are placed **below** the node, stacked downward. The first drop's top is:

```
box i top = nodeY + yOff + i * DROP_UNIT
yOff      = max(NODE_W/2, nodeHH) + DROP_SPACER + dropNestingDepth * INTER_PAD
```

- `nodeHH`: outermost tower half-height of the owner node (0 if unwrapped). Ensures drops start below the tower bottom.
- `dropNestingDepth`: number of encircling wrappers around the drop lollipop itself. Each encircling pushes the drop further down so the encircling box top clears the node bottom.
- `DROP_UNIT = DROP_BOX_H + DROP_SPACER = 20`

`measureDropOffsets(boxRoot, edgeRoot)` computes `Map<dropRootId, yOff>` structurally (no positions needed) and is used by the renderer. `measureNodeHH(boxRoot)` computes `Map<edgeNodeId, hh>` where `hh = DROP_BOX_H/2 + nestingDepth * INTER_PAD`.

### `computeClearances` — downward fence per node

`computeClearances(boxRoot, edgeRoot, dropCounts)` returns `Map<edgeNodeId, clearance>` — how far below `node.y` the node's lowest visual element reaches, measured to `parent.y - NODE_W/2 - INTER_PAD` (the parent's fence bottom). Both drops and towers are accounted for in one value:

```
yOff         = max(NODE_W/2, nodeHH) + DROP_SPACER + dropDepth * INTER_PAD
dropNeeded   = k > 0 ? yOff + k * DROP_UNIT + DROP_BOX_H : 0
towerNeeded  = yOff + DROP_BOX_H + dropDepth * INTER_PAD + INTER_PAD  // for drop towers
boxNeeded    = hh + INTER_PAD                                           // for node towers
clearance(n) = max(dropNeeded, towerNeeded, boxNeeded)
```

**Drop lollipops inside a tower**: `computeClearances` detects nullary box-tree nodes (drop lollipops), looks up their edge-tree owner via `dropId → ownerCellId` (built from `edgeRoot`), and stamps the owner.

**Unwrapped nodes with drops**: seeded directly from `edgeRoot` before the box-tree walk.

**Box-tree leaf nodes** (edge-tree nodes, `children: null`): stamped before the early-return so Phase 3b finds their ids in the map.

### Phase 3b — two-constraint lift

```
parentHH = measureNodeHH(boxRoot).get(parent.id) ?? 0
fenceBot  = parent.y − NODE_W/2 − INTER_PAD

// Constraint 1: downward — node's bottom clears fenceBot
maxY1 = clearance > 0 ? fenceBot − clearance : ∞

// Constraint 2: upward — node's top clears parent's tower top
maxY2 = parentHH > 0 ? parent.y − parentHH − NODE_W/2 − INTER_PAD : ∞

maxY = min(maxY1, maxY2)
if node.y > maxY:
    shift entire subtree up by (node.y − maxY)
```

Processing `eachBefore` (top-down) means parent lifts propagate before children are corrected.

### Phase 3a — root / stem

```
neededStem = clearances.get(root.id) ?? 0
if stemLen < neededStem:
    lift entire tree by (neededStem − stemLen)
    root._stemLen = neededStem
```

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

### Invariant 5 — Branch extension for wrapped nodes

Intermediate boxes extend both upward and downward from their owner node. Phase 3 correction ensures:
- The tower/drop bottom clears the parent node's fence (downward constraint).
- The tower top clears the parent's own tower top (upward constraint).

See the Phase 3 section for the complete two-constraint lift formula.

### Known remaining visual issues

- **Branches passing through intermediate boxes**: The branch from a wrapped node to its parent
  passes vertically through the intermediate box. This is inherent — the branch is drawn in the
  tree layer (on top) so it remains visible through the semi-transparent box fill.

---

## Bugs / TODO

### Vertical branch segments must be fenced by intermediate boxes
**Status**: not yet fixed.
Currently the x-VPSC fences only **node centres** (roundrects). But each node's vertical branch
segment runs at its x-coordinate from the node down to the corolla bus — a vertical line that
intermediate boxes can cross without VPSC reacting.

Example: as a tower grows rightward, it eventually crosses a sibling's vertical branch segment,
which should push that sibling (and its entire subtree) to the right. Siblings whose vertical
branch is on the far side of the tower are unaffected — they stay put until the tower's
opposite edge crosses their branch.

**Fix direction**: when computing sibling separation in `halfWidthMap`, treat the sibling's
effective half-width as `max(NODE_W/2, subtreeHalfWidth)` so the VPSC constraint fires when
the tower edge reaches the sibling's vertical branch, not just when it reaches the node centre.
This is the same fix needed for "sibling subtree buses trampled" — these are the same bug.

### Sibling subtree buses trampled by intermediate boxes
**Status**: not yet fixed.
`halfWidthMap` seeds every sibling with `NODE_W/2 = 8`. VPSC therefore only pushes a sibling
node 28 px outside the box edge. But the sibling may be an inner node whose children spread
much wider than 8 px. The children stay at Phase-1 positions while the sibling node moves left,
so the children end up *inside* the intermediate box's rectangle. This causes the corolla bus
of the sibling to visually disappear behind the box.

**Fix needed (two parts)**:
1. Compute each node's Phase-1 *subtree half-width* bottom-up and seed `halfWidthMap` with
   that value instead of `NODE_W/2`.
2. Add rigid-body constraints for *sibling* subtrees too (not just the wrapped node's subtree)
   so that when VPSC pushes a sibling, all its descendants follow as a unit.

### Encircling the parent of a shifted tower jumps to the side
**Status**: reproducible, not yet fixed.
Steps to reproduce: build a tower (encircle one node several times). The tower shifts sideways
due to VPSC. Then encircle the *parent* node (the one that the equality constraint pins to the
tower). The new intermediate box for the parent appears at a different x-position — it "jumps".

Root cause: when a new intermediate box is created for the parent, `intermediateBoxes` computes
its centre from `extMap`, which uses the VPSC-solved positions. But `desiredPosition` in the
new Variable for the parent is the Phase-1 x (not the VPSC-solved x), so Phase-2 layout
re-centres things around the old desired x, not the current visual x.

### ⚠️ Edge labels creep into drop zone on long branches — FIXED
Was: `d.y + branchLen * 2/3 + 4` — proportional to actual branch length, so Phase 3 lifting
caused the label to drift upward and break alignment with sibling labels on the same bus.

Fix: fixed offset from the **parent** using the *initial* branch pitch:
```
label.y = parent.y - (TREE_H / maxDepth) / 3 + 4
```
The initial Δy is `stemLen / 3` above the parent. This never changes regardless of lifting,
keeping all labels on the same bus horizontally aligned. Same formula for the stem label.

### Drop z-order must be topmost
**Status**: not yet fixed.
Drop roundrects (the slashed boxes) are rendered inside the box layer, below the tree layer.
They should be rendered **above** everything else (on top of tree-node roundrects and
intermediate boxes) so that they remain clickable and visually distinct. Fix: move the drop
`<g>` blocks to after the `<g class="tree-layer">` in `AtomicDiagramView.svelte`, or give
them their own top-level `<g class="drop-layer">`.

### Nullary edgeRoot node rendered outside base box after stem drop (known bug)
**Status**: not yet fixed.
When a stem drop is inserted (drop on the root node of `edgeRoot`), `computeSucc` produces
a lollipop child in the next level's edgeRoot. After dimension hopping, `withOuterFrame`
correctly excludes that lollipop from `innerNodes` (it has `children.length === 0`), so it
gets no leaf box in `root`. However, `AtomicDiagramView` still renders a `tree-node` roundrect
for it (line 340 filter: `d.children || d.data.nullary`). Since the lollipop has no leaf box,
no force pulls its visual position inside the base box — it floats at its raw edge-tree y
position, which is typically above (outside) the frame rect.

**Fix direction**: either suppress the roundrect for lollipops that have no corresponding leaf
box in `focus.root`, or expand `adjustedFrameRect` to enclose all `nullary` edgeRoot nodes.

### Disconnected edge-tree branches after multi-node encircle (reproducible)
**Status**: not yet fixed.
Steps to reproduce: "Point" example → extrude twice → select both nodes → encircle.
The Focus tree's edge-tree lines appear severed — the vertical branches between the two
encircled nodes are no longer drawn connected to their parent node.

Root cause (suspected): `leafCeiling` is derived from `adjustedFrameRect.y − DROP_SPACER`.
After encircle, the new intermediate box may push `adjustedFrameRect` upward (lower y),
pulling `leafCeiling` above one or more node y-positions. The leaf-tip extension for such
nodes runs from `node.y` up to `leafCeiling`, which may overshoot and visually disconnect
the branch from the corolla bus drawn by `corollaElements`.

**Minimal investigation needed**:
1. After encircle, log `adjustedFrameRect.y`, `leafCeiling`, and each node's `y`.
2. Check whether any node has `y < leafCeiling` — if so, its corolla bus path and the
   tip extension never meet, leaving a gap.

**Fix direction**: ensure `leafCeiling` is clamped to at most `min(node.y) − ε` so
extensions never exceed the node positions, OR compute `leafCeiling` from the raw
`frameRect.y` (before intermediate box expansion) so encircling cannot pull it up.

### Multi-node encircle rigid-body (not yet implemented)
The rigid-body constraints (`addRigid`) that keep open branches and inner nodes aligned are only
applied for **single-node** intermediate boxes (`vars.length === 1`). For a box encircling
**multiple** edge-tree nodes the containment constraint pushes the outermost pair apart, but the
subtrees rooted at each enclosed node are not currently rigidly linked to their respective parents.
This can produce diagonal branches above a multi-node encircled group. When multi-node encircle
is exercised, extend `addRigid` to cover each node in `ids`.

### Optical centering (not yet implemented)
`topOff = (height - TREE_H - stemLen) / 2` only vertically centres the raw tree extent.
The full bounding box (including frame, drops, intermediate boxes) is not centred. The
x-centering similarly ignores `adjustedFrameRect`. Two-pass fix: lay out → compute bbox →
translate everything so bbox centre equals pane centre.

### Auto-scaling (not yet implemented)
When `adjustedFrameRect` exceeds `paneWidth/Height - 2*PANE_MARGIN`, apply a uniform SVG
`transform="scale(s)"` (around bbox centre) so the diagram always fits with minimum margins.

### y-VPSC (not yet implemented)
If a wrapped group at depth D has `hh > stemLen - ARC_R - INTER_PAD`, Phase 3b lifts the
subtree. But this lift can cascade upward through ancestors, compressing sibling branches. A
proper y-VPSC pass would enforce minimum branch lengths as constraints rather than a greedy
top-down sweep. Relevant when deeply nested towers appear in deep trees.

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

1. ✅ Extract current `computeLayout` into `frontend/lib/layout.ts` (no behaviour change)
2. ✅ Add `measureMinSpans(root: Tree): Map<string, number>` to `layout.ts`
3. ✅ Phase 1 equal-interval leaf spread + bottom-up median (unchanged from original)
4. ✅ Add VPSC x-pass after desired positions are set (halfWidthMap + sibling sep + containment)
   - ✅ Single-node wrap: equality constraint `parent.x == wrapped.x`
   - ✅ Single-node wrap: rigid-body constraints for wrapped subtree
   - ✅ Branch extension (Phase 3b / 3a) for intermediate box clearance (`computeClearances`, `measureNodeHH`, `measureDropOffsets`)
   - ⬜ Sibling subtree halfWidths + rigid body (see Bugs/TODO)
5. ✅ `intermediateBoxes` derived in `AtomicDiagramView` from VPSC-solved coords (stays in view — too coupled to drop layout)
6. ⬜ Port x-VPSC to `TreeDiagram` (sibling separation only — no boxes; unblocked by dimension hopping)
7. ⬜ y-VPSC (see Bugs/TODO)

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
