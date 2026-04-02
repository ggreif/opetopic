# AtomicDiagramView — Layout Strategy

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

## Why root is different

The root's outgoing branch is the **stem** (going downward), not a branch toward a parent node. There is no `d.parent` in the d3 hierarchy, so the non-root correction cannot apply. Instead, the stem is lengthened and the tree is shifted upward uniformly. The visual effect is the same — more space for drop boxes — but the mechanism is different because the stem length is a derived constant (`_stemLen`) rather than an implicit distance to a parent node.

**Ideal future fix**: unify both cases by treating the stem as a virtual parent at `rootY + stemLen`, so the same formula `maxY = virtualParent.y − ARC_R − needed` can be used for all nodes. This would eliminate the root special-case.
