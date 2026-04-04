# Plan: Regression Testing with Red/Green TDD + DOM-diffing EDSL

## Context

The opetopic editor has complex combinators whose correctness is ultimately a **visual** question —
did the right boxes, branches, labels, and highlights appear in the SVG? Pure data-model checks are
necessary but not sufficient. The primary assertion surface is the rendered DOM of
`AtomicDiagramView`. An EDSL drives sequences of operations; after each step the rendered SVG
snapshot is diffed against a golden file.

Vitest 4.1.2 is already a devDependency. `jsdom` is in node_modules. Need to install
`@testing-library/svelte@5` (Svelte 5 compatible).

---

## Architecture

### Primary — DOM snapshot tests via Svelte component rendering

Mount `AtomicDiagramView` directly (it is fully self-contained — takes a `diagram: AtomicDiagram`
prop, renders pure SVG, no store dependency). Use `@testing-library/svelte` + `jsdom`.

What to snapshot / diff:
- **Element counts by class**: number of `.tree-node`, `.box-rect`, `.box-rect.leaf`,
  `.corolla-link`, `.edge-label` elements
- **Text content**: all `.edge-label` and `.box-label` text nodes (cell labels)
- **Class presence after interaction**: `.tree-node.selected`, `.corolla-link.highlighted`,
  `.box-rect.highlighted`
- **Full innerHTML snapshot** for regression: stable because SVG coordinates are deterministic
  given fixed tree structure + fixed width/height

Hover/selection triggered by `fireEvent.mouseEnter` / `fireEvent.click` on elements found by
class or label text — no mouse coordinates.

---

## Assertion levels and diff-guided snapshot extraction

Three levels of increasing specificity:

**Level 1 — Structural** (element counts + labels): fast, geometry-independent, always present.
Catches missing/extra elements. Acts as a *change detector*: if the count of `.box-rect:not(.leaf)`
goes from 1 → 2, that tells you an encircle wrapper appeared.

**Level 2 — Diff-guided inline snapshot** (`toMatchInlineSnapshot`): triggered by a Level 1
structural change. The structural diff identifies *which* element is new or changed; only that
element's innerHTML (or a focused subtree) is snapshotted inline. No separate `.snap` files.
Pins the DOM *shape* of exactly what the combinator produced.

**Level 3 — Full innerHTML golden** (`toMatchSnapshot`): too noisy for geometry changes, not used.

### Key visuals to capture at Level 2

Structural changes imply specific visual properties worth pinning:

| Combinator | Structural signal | Key visuals to snapshot |
|---|---|---|
| `extrude` | new `.tree-node` | shape (rx/ry), dimensions, position relative to corolla bus and its child branches (Δy) |
| `drop` | new `.box-rect.leaf` | bounding rect, position relative to owner `.tree-node` (Δy from node centre to box top) |
| `encircle` | new non-leaf `.box-rect` | bounding rect enclosing the wrapped nodes + padding, relative to enclosed `.tree-node` positions |
| `hop` | no structural change | (no Level 2 assertion needed unless pane content changes) |
| selection | `.tree-node.selected` | fill colour / stroke change; context menu `<ul>` contents when right-clicked |
| hover | `.corolla-link.highlighted` | stroke colour, which branch is highlighted vs others |

### Relative geometry assertions (avoiding absolute coordinates)

Rather than pinning `x="155.8"` (breaks on any layout change), pin *deltas*:
- `dropBox.y - ownerNode.y` — drop box offset below its node (must be > `DROP_SPACER`)
- `intermediateBox.x` vs enclosed node `x` — horizontal centering
- `corolla-link` path y-span — must not extend above `leafCeiling` (catches the lollipop spike bug)
- `tree-node` rect centre vs the midpoint of its child branches — horizontal bus alignment

These are computed from parsed SVG attributes at test time; jsdom exposes them via
`getBoundingClientRect()` or directly from attribute strings. Geometry deltas are stable
across optical-centering and auto-scaling changes that shift absolute positions.

### Supporting — Sequence EDSL  (`frontend/lib/opetope-edsl.ts`)

A `Tape` class that drives both the data model AND the rendered DOM through a named sequence:

```typescript
type TapeStep =
  | { op: 'start';    example: 'point' | 'boxtree' | 'simplex' | 'ypsilon' }
  | { op: 'extrude';  label: string }       // source-extrude leaf named `label`
  | { op: 'drop';     label: string }       // drop-insert on node named `label`
  | { op: 'hop';      delta: 1 | -1 }       // dimension hop
  | { op: 'encircle'; labels: string[] }    // encircle nodes named `labels`

class Tape {
  steps: TapeStep[]
  diagrams: AtomicDiagram[]
  focusIdx: number

  // Fluent builder (each returns `this` for chaining)
  start(example: string): this
  extrude(label: string): this
  drop(label: string): this
  hop(delta: 1 | -1): this
  encircle(labels: string[]): this

  // Data-model guard (secondary)
  validate(): string | null       // validateStack; null = clean

  // Serialisation — round-trips through console log
  toJSON(): TapeStep[]
  static fromJSON(steps: TapeStep[]): Tape
  static fromLog(lines: string[]): Tape    // parses [EDSL] {...} lines
}
```

Gadget resolution: `subtreeFor` walk on `focus.edgeRoot` matching `cell.label`. Labels unique
within a diagram → deterministic.

### In-page "Record" button

A **Record** button in `OpetopeBuilder.svelte` (or the builder toolbar) starts a recording
session. While recording:

- A `MutationObserver` is attached to the three pane containers (`.prev-pane`, `.focus-pane`,
  `.succ-pane`) observing `childList`, `subtree`, and `attributes`
- After each combinator fires (extrude / drop / hop), the observer callback captures the
  current `.atomic-diagram` SVG `innerHTML` of the Focus pane (and optionally Prev/Succ)
  as a DOM snapshot alongside the matching `TapeStep`
- Clicking **Stop** (same button, toggled) emits the full recording to the **console** as a
  single structured log entry (JSON or pretty-printed EDSL string) ready for copy & paste
  directly into a TypeScript test file

Workflow:
1. Click **Record**, perform the interaction
2. Click **Stop**
3. DevTools console shows the EDSL sequence + DOM snapshots
4. Copy & paste into `frontend/components/AtomicDiagramView.test.ts` as a `Tape.fromLog()`
   call with inline golden snapshots

The backend (low priority) is a secondary destination: the same JSON can be uploaded to an
ICP canister for server-side regression storage.

**Button placement**: toolbar row in `OpetopeBuilder.svelte` next to the example buttons.
**State**: `let recording = $state(false)` + accumulated steps/snapshots in local arrays.

## Console log → tape extraction

```typescript
// handleSourceExtrude: console.log('[EDSL]', JSON.stringify({ op:'extrude', label }))
// handleDropInsert:    console.log('[EDSL]', JSON.stringify({ op:'drop',    label }))
// hop $effect:         console.log('[EDSL]', JSON.stringify({ op:'hop',     delta }))
```

Workflow to shrink-wrap a found repro:
1. Reproduce bug in browser, copy `[EDSL] {...}` lines from DevTools
2. Pass to `Tape.fromLog()`
3. Render with `AtomicDiagramView`, capture snapshot — this is the **red** golden file
4. Fix the combinator, run test, snapshot now differs → update golden → **green**

---

## Test file layout

```
vitest.config.ts                          create — include Svelte plugin, jsdom env
package.json                              modify — add "test": "vitest run"
frontend/lib/opetope-edsl.ts              create — Tape class
frontend/lib/opetope-edsl.test.ts         create — sequence tests (data-model layer)
frontend/components/AtomicDiagramView.test.ts  create — DOM snapshot tests (primary)
frontend/test/tapes/*.tape.json           create per scenario — shrink-wrapped sequences
frontend/test/snapshots/*.svg.snap        auto-generated by vitest snapshot
frontend/components/OpetopeBuilder.svelte modify — add [EDSL] JSON console lines
```

---

## vitest.config.ts outline

```typescript
import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    environment: 'jsdom',
    include: ['frontend/**/*.test.ts'],
  },
})
```

---

## First red/green cycles (DOM-first)

### Red 1 — Point renders one edge-label
```typescript
test('Point: single edge-label with text "a"', async () => {
  const { container } = render(AtomicDiagramView, {
    props: { diagram: { edgeRoot: point()[0], root: null }, drops: [] }
  })
  const labels = container.querySelectorAll('.edge-label')
  expect(labels).toHaveLength(1)
  expect(labels[0].textContent).toBe('a')
})
```

### Red 2 — Source extrude adds a tree-node
```typescript
test('after extrude: two tree-nodes appear', async () => {
  const tape = new Tape().start('point').extrude('a')
  const { container } = render(AtomicDiagramView, { props: { diagram: tape.focus, drops: [] } })
  expect(container.querySelectorAll('.tree-node')).toHaveLength(2)
})
```

### Red 3 — Drop inserts a drop-box (`.box-rect.leaf` inside box-layer)
```typescript
test('after drop on "a": one drop box appears', async () => {
  const tape = new Tape().start('point').extrude('a').drop('a')
  const { container } = render(AtomicDiagramView, { props: { diagram: tape.focus, drops: collectDrops(tape.focus.edgeRoot) } })
  const dropBoxes = container.querySelectorAll('.box-layer .box-rect.leaf')
  expect(dropBoxes).toHaveLength(1)
})
```

### Red 4 — Hover bond: hovering lollipop highlights drop box
```typescript
test('hover lollipop branch → drop box gets highlighted class', async () => {
  const tape = new Tape().start('point').extrude('a').drop('a')
  const { container } = render(AtomicDiagramView, {
    props: { diagram: tape.focus, drops: collectDrops(tape.focus.edgeRoot),
             highlightNode: /* branchId of lollipop */ tape.lolliToBranchId('γ') }
  })
  expect(container.querySelector('.box-rect.leaf.highlighted')).toBeTruthy()
})
```

---

## Key existing assets to reuse

| Asset | File | Use |
|---|---|---|
| `point()`, `boxtree()`, `simplex()`, `ypsilon()` | `opetope.ts` | Fixtures |
| `collectDrops()` | `opetope.ts` | Pass to `drops` prop in tests |
| `validateDiagram()`, `validateStack()` | `validate.ts` | Secondary guards |
| `subtreeFor()` | `opetope.ts` | Gadget resolution in Tape |
| `withOuterFrame()` | OpetopeBuilder (copy/inline into Tape) | `start()` initial state |
| jsdom | node_modules | Already present |
| vitest 4.1.2 | package.json | Already present |

Need to install: `@testing-library/svelte@5`

---

## Verification

1. `npm test` — all DOM snapshot tests pass, no regressions
2. Any `[EDSL]` console sequence from browser is pasteable into `Tape.fromLog()` and renders
3. Each known bug has a `.tape.json` + `.svg.snap` captured before the fix (red),
   updated snapshot after fix (green)
4. Hover test confirms the `lolliCellToBranchId` remapping works end-to-end in rendered DOM

---

## Backend residency (low priority)

The regression test suite can alternatively live in the **backend** (Motoko canister or a
separate test canister). The tape JSON files are portable; a Motoko test runner could:
1. Load a `.tape.json` sequence
2. Call the pure combinator logic (if ported or re-implemented in Motoko)
3. Assert the resulting tree structure as a serialised string

This is lower priority than the frontend vitest approach but is an option once the on-chain
logic layer is established.

## Deferred

- Playwright E2E: out of scope for now
- Automatic sequence shrinking: manual tape editing
- `TreeDiagram.svelte` and `BoxDiagram.svelte` snapshot tests: follow same pattern once
  `AtomicDiagramView` tests are established
- Backend regression tests: see "Backend residency" section above

---

# ~~Plan: Selection Highlight (kind 2) + Encircle UX~~ (SUPERSEDED)

## Context

The previous plan (focus.root / computeSucc) is fully implemented. What remains is making
**node selection** visually distinct from **bond hover** in the Focus pane, then wiring that
selection to trigger encircle.

Three kinds of highlighting exist:
1. **Bond** — purple stroke on edges/box outlines; works correctly.
2. **Subtree selection** — needed for encircle; currently identical to bond hover (confusing).
3. **Opetope face** — future; algorithm exists but UI not yet built.

---

## Visual design

### Focus tree-node roundrects (currently)
| State | fill |
|---|---|
| default | `#333` (dark solid) |
| `.highlighted` (Succ→Focus hover) | `#a02480` (purple) |
| `.selected` | `#a02480` (purple — same as hover, indistinguishable) |

### Focus tree-node roundrects (target)
| State | fill | stroke |
|---|---|---|
| default | `white` | `#333`, 1.5px |
| `.highlighted` (Succ→Focus hover) | `white` | `#a02480`, 2.25px |
| `.selected` | `#e53935` (opaque red) | `#333`, 1.5px |

Nodes become hollow by default — visually consistent with drops and box-rects (white fill +
dark stroke). Selection turns the fill opaque red, unambiguously distinct from the purple bond
hover stroke.

### Succ branch when Focus node is selected
Currently: `highlight={selectedId ?? succHoveredId ?? undefined}` — both selection and hover
drive the same purple `.corolla-link.highlighted`.

Target: add a `selectionHighlight` prop to `TreeDiagram` (separate from `highlight`). When set,
the matching branch gets a **red stroke** (`.corolla-link.selected-highlight { stroke: #e53935 }`).
In OpetopeEditor: pass `selectionHighlight={selectedId ?? undefined}` and keep
`highlight={succHoveredId ?? undefined}` for hover only.

---

## Encircle trigger (unchanged)

- Single click on a tree-node in Focus → select/deselect (toggle).
- Ctrl+click on a **selected** non-root node → context menu with "Encircle".
- `handleEncircle(cellId)` in OpetopeBuilder already works correctly.

No change to the encircle data logic — only visual distinction is missing.

---

## Step 1 — `AtomicDiagramView.svelte` CSS

```css
:global(.tree-node) {
  fill: white;
  stroke: #333;
  stroke-width: 1.5;
  cursor: pointer;
  pointer-events: all;
  vector-effect: non-scaling-stroke;
  transition: fill 0.1s, stroke 0.1s;
}
:global(.tree-node.highlighted) {
  stroke: #a02480;
  stroke-width: 2.25;
}
:global(.tree-node.selected) {
  fill: #e53935;
  cursor: context-menu;
}
```

---

## Step 2 — `TreeDiagram.svelte`: add `selectionHighlight` prop

```typescript
let {
  tree, width, height, highlight, selectionHighlight = undefined, drops, onhover, oncellclick, ondropinsert
}: {
  ...
  selectionHighlight?: string
  ...
} = $props()
```

In the branch render loop, add:
```svelte
class:selection-highlighted={branch.id === selectionHighlight}
```

CSS:
```css
:global(.corolla-link.selection-highlighted) {
  stroke: #e53935;
  stroke-width: 2.25;
}
```

Stem (root output) uses `branch.id = root.cell.id` — already correct.

---

## Step 3 — `OpetopeEditor.svelte`: split highlight into hover vs selection

```svelte
<!-- Succ pane -->
<TreeDiagram
  tree={computeSucc(focus.root)}
  drops={[]}
  width={280}
  height={340}
  highlight={succHoveredId ?? undefined}
  selectionHighlight={selectedId ?? undefined}
  onhover={(id) => { succHoveredId = id }}
  oncellclick={handleCellClick}
/>
```

---

## Step 4 — Intermediate boxes (encircle visual in Focus)

After `encircle`, `focus.root` gains wrapper nodes that are **not** present in `edgeRoot`. These
must be rendered as nested box rects around their contained leaf descendants.

**Algorithm** (`intermediateBoxes` derived store):
- Walk `focus.root` recursively; skip the root (outer frame) and leaves (leaf boxes = tree-node rects).
- For each intermediate node, collect all leaf-descendant IDs and look up their `(x, y)` positions
  from the edge-tree layout (`posMap`).
- Bounding rect = `min/max(x ± s, y ± s) ± INTER_PAD` where `s = DROP_BOX_H/2`, `INTER_PAD = 10`.
- Render as `box-rect` with label; hover fires both `onhover` and `onnodehover` for bidirectional
  bond highlighting with the matching Succ branch.

**Context menu guard**: remove `d.parent &&` check — all tree-node rects are leaf boxes in
`focus.root`, all are valid encircle targets. Only the outer frame (`diagram.root.cell.id`) is
excluded by the existing guard in `encircle()` itself.

### `intermediateBoxes` derived — critical implementation details

The derived store computes bounding rects for all non-root, non-leaf, non-lollipop nodes of
`focus.root`. Three bugs to avoid:

1. **Lollipop guard**: bail on `children.length === 0` as well as `children === null` — otherwise
   drops (lollipops in `focus.root`) produce spurious intermediate boxes.

2. **Post-order traversal**: recurse into children first so each level's extent is in `extMap`
   before the parent computes its own bounding rect. Pre-order breaks at depth ≥ 2.

3. **`extMap` stores half-extents `{cx, cy, hw, hh}`**, not just centers. Using only `{x,y}`
   with a fixed `s = DROP_BOX_H/2` makes every encircling level the same size — the outer
   wrapper uses the actual pixel extent of its child box. Seed `extMap` with:
   - Edge-tree nodes: `hw = hh = DROP_BOX_H/2`
   - Drop rects: `hw = dr.w/2, hh = dr.h/2`
   - Each computed intermediate box: `hw = ib.w/2, hh = ib.h/2` (added post-order)

4. **Direct children only**: bounding rect uses `t.children.map(c => extMap.get(c.cell.id))`,
   NOT a recursive `leafIds()` walk. Recursing to leaves makes all levels collapse to the same
   innermost positions.

### Selectable drops and intermediate boxes

Drops and intermediate boxes are also nodes in `focus.root` and can be encircled. Both get:
- `onclick`: toggle `selectedId` (same pattern as tree-node rects)
- `oncontextmenu`: open Encircle menu when already selected
- `class:selected`: red stroke (`box-rect.selected { stroke: #e53935; stroke-width: 2.25 }`)
  — uses stroke rather than fill since these are hollow box-rects
- `cursor: context-menu` when selected (inline style, since box-rects use `cursor: default/pointer` already)

---

## Files modified

| File | Change |
|------|--------|
| `frontend/components/AtomicDiagramView.svelte` | Tree-node CSS: white fill default, red fill when selected, purple stroke when highlighted; `intermediateBoxes` derived store; remove `d.parent` guard from context menu |
| `frontend/components/TreeDiagram.svelte` | Add `selectionHighlight` prop; add `.corolla-link.selection-highlighted` CSS (red stroke) |
| `frontend/components/OpetopeEditor.svelte` | Split Succ `highlight` (hover only) from `selectionHighlight` (selectedId); `svelte:window onclick` for global deselect |

---

## Verification

1. Default: all tree-node roundrects in Focus are white with dark border. ✓
2. Hover Succ branch → Focus node gets purple stroke (not filled). ✓
3. Hover Focus node → Succ branch gets purple stroke. ✓
4. Click Focus node → node turns red; corresponding Succ branch turns red. ✓
5. Click same node again → deselects, both return to default. ✓
6. Right-click selected node (any, including root-edge nodes) → context menu → Encircle → encircle fires. ✓
7. Bond hover (Prev↔Focus) unaffected by this change. ✓
8. After encircle: intermediate wrapper box appears in Focus around enclosed leaf rects. ✓
9. Hover intermediate box → corresponding Succ branch highlights (and vice versa). ✓
10. Click outside Focus SVG (other panes, toolbar) → deselects. ✓
