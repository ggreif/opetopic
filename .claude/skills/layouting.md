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

## Shared concept: EdgeTreeView

`TreeDiagram` (Succ pane) and the tree layer of `AtomicDiagramView` (Focus pane) both render edge trees using the same logic: `buildHier`, `computeLayout`, `corollaElements`, node roundrects, branch paths, hover/click wiring. They are the **same concept**.

Planned refactor: extract a shared `EdgeTreeView` component. `TreeDiagram` becomes a thin wrapper; `AtomicDiagramView` composes `EdgeTreeView` + the box layer.

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
