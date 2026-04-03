# Plan: Dimension Hopping

## Design decisions

**Q: Where does state live?**
Module-level `.svelte.ts` file (`diagramStore.svelte.ts`) — avoids prop-drilling, keeps `OpetopeBuilder` as a thin coordinator, matches Svelte 5 runes idiom.

**Q: What does Prev show after hopping?**
Prev continues to show `focus.edgeRoot` as `BoxDiagram` (the substrate tree). This equals `computeSucc(diagrams[focusIdx-1].root)` by invariant — no renderer change needed.

**Q: When a level is edited, what happens to higher levels?**
Truncate the array to length `focusIdx + 1`. The invariant `diagrams[i+1].edgeRoot === computeSucc(diagrams[i].root)` would be violated otherwise. The user hops right to rebuild.

**Q: What dimension number is shown per pane?**
Show `edgeRoot.cell.dim` per pane — mathematically meaningful, not just a sequence index.

---

## Step 1 — New file: `frontend/lib/diagramStore.svelte.ts`

```typescript
import { computeSucc, type AtomicDiagram } from './opetope'

export let diagrams = $state<AtomicDiagram[]>([/* initial example set in OpetopeBuilder */])
export let focusIdx = $state<number>(0)

export const focus       = $derived(diagrams[focusIdx])
export const succDiagram = $derived(diagrams[focusIdx + 1] ?? null)

export function hopLeft() {
  if (focusIdx > 0) focusIdx--
}

export function hopRight() {
  if (!diagrams[focusIdx].root) return  // can't hop right without a box tree
  if (focusIdx + 1 < diagrams.length) {
    focusIdx++
  } else {
    const newEdgeRoot = computeSucc(diagrams[focusIdx].root!)
    diagrams = [...diagrams, { edgeRoot: newEdgeRoot, root: null }]
    focusIdx++
  }
}

export function updateFocusDiagram(next: AtomicDiagram) {
  diagrams = [...diagrams.slice(0, focusIdx), next]  // truncate higher levels
}

export function resetTo(diagram: AtomicDiagram) {
  diagrams = [diagram]
  focusIdx = 0
}
```

**Key invariant:** `diagrams[i+1].edgeRoot === computeSucc(diagrams[i].root)` is established by `hopRight` and preserved by `updateFocusDiagram` (via truncation).

---

## Step 2 — Modify `frontend/lib/validate.ts`

Add at the bottom (import `computeSucc` from `./opetope` at the top):

```typescript
function treeShapeEquals(a: Tree, b: Tree): boolean {
  if (a.cell.id !== b.cell.id) return false
  if ((a.children === null) !== (b.children === null)) return false
  if (a.children === null) return true
  if (a.children.length !== b.children.length) return false
  for (let i = 0; i < a.children.length; i++) {
    const [abid, achild] = a.children[i]
    const [bbid, bchild] = b.children[i]
    if (abid !== bbid) return false
    if (!treeShapeEquals(achild, bchild)) return false
  }
  return true
}

export function validateStack(diagrams: AtomicDiagram[]): string | null {
  for (let i = 0; i < diagrams.length; i++) {
    const v = validateDiagram(diagrams[i])
    if (v) return `[level ${i}] ${v}`
  }
  for (let i = 0; i < diagrams.length - 1; i++) {
    const d = diagrams[i]
    if (!d.root) continue
    const expected = computeSucc(d.root)
    if (!treeShapeEquals(expected, diagrams[i + 1].edgeRoot))
      return `[bond ${i}→${i+1}] edgeRoot of level ${i+1} does not match computeSucc of level ${i}`
  }
  return null
}
```

---

## Step 3 — Modify `frontend/components/OpetopeEditor.svelte`

**Remove props:** `focus`, `violation`. Read from store instead.

**New imports:**
```typescript
import { focus, succDiagram, focusIdx, diagrams, hopLeft, hopRight } from '../lib/diagramStore.svelte'
import { validateStack, computeSucc } from '../lib/validate'  // computeSucc re-exported or imported from opetope
```

**New derived state:**
```typescript
const violation       = $derived(validateStack(diagrams))
const succAtomicDiagram = $derived<AtomicDiagram | null>(
  !focus.root ? null
  : succDiagram                                              // level already exists in store → show it as-is
    ?? { edgeRoot: computeSucc(focus.root), root: null }    // level not yet created → preview only
)
const canHopLeft  = $derived(focusIdx > 0)
const canHopRight = $derived(focus.root !== null)
const focusDim    = $derived(focus.edgeRoot.cell.dim)
```

`succAtomicDiagram` priority:
1. `null` (hide pane) — when `focus.root === null`, nothing to derive a Succ from
2. `diagrams[focusIdx + 1]` — when the next level exists in the store, show it verbatim (its `edgeRoot` is the authoritative stored value, not recomputed)
3. `{ edgeRoot: computeSucc(focus.root), root: null }` — preview when the level hasn't been created yet (user hasn't hopped right)

The recompute from `computeSucc` is only a **preview** for the empty slot case. Once the user hops right and the level enters the store, the stored `edgeRoot` is used. The `validateStack` cross-level check (`treeShapeEquals`) ensures the stored `edgeRoot` matches `computeSucc` of the level below.

**Template layout** — flex row:
```
[prev-pane] [◀ button] [focus-pane] [▶ button] [succ-pane (AtomicDiagramView, read-only)]
```

**Succ pane change:** Replace `<TreeDiagram>` with `<AtomicDiagramView diagram={succAtomicDiagram} readonly />`. Pass `ondropinsert=undefined` and `onsourceextrude=undefined` so it is read-only.

**Arrow handlers** (reset hover state before hopping):
```typescript
function onHopLeft() {
  hoveredId = null; succHoveredId = null; selectedIds = new Set()
  hopLeft()
}
function onHopRight() {
  hoveredId = null; succHoveredId = null; selectedIds = new Set()
  hopRight()
}
```

**Dimension badges:** `<div class="dim-badge">dim {n}</div>` in each pane, bottom-right.
- Prev: `focusDim`
- Focus: `focus.root?.cell.dim ?? '?'`  (one higher)
- Succ: `focus.root?.cell.dim !== undefined ? focus.root.cell.dim + 1 : '?'`

---

## Step 4 — Modify `frontend/components/OpetopeBuilder.svelte`

- Remove `let focus = $state<AtomicDiagram>(...)` and `let violation = $state<string | null>(null)`
- Import `updateFocusDiagram`, `resetTo`, `focus` from store
- Replace `setFocus(next)` pattern with:
  ```typescript
  function setFocus(next: AtomicDiagram) {
    const v = validateDiagram(next)
    if (v) { console.log('[validateDiagram] VIOLATION:', v); return }
    updateFocusDiagram(next)
  }
  ```
- `loadExample(make)` → calls `resetTo(withOuterFrame(make()))` instead of `setFocus(...)`
- Remove `{focus}` and `{violation}` from `<OpetopeEditor>` call site
- Initialise store in module-level `$effect` or via the store's `resetTo` being called once at startup

**Nascent animation**: after `updateFocusDiagram`, the cell lookup `subtreeFor(focus.edgeRoot, newCell.id)!.cell` uses the `focus` derived from the store — this resolves to the cell in the newly written entry, so the timer still works. No change needed.

---

## Step 5 — CSS additions to OpetopeEditor

```css
.hop-arrow {
  align-self: center;
  background: none;
  border: 1px solid #ccc;
  border-radius: 50%;
  width: 28px; height: 28px;
  font-size: 14px;
  cursor: pointer;
  color: #666;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  flex-shrink: 0;
}
.hop-arrow:hover:not(:disabled) { background: #f3e5f5; color: #a02480; border-color: #a02480; }
.hop-arrow:disabled { opacity: 0.3; cursor: default; }

.dim-badge {
  font-size: 0.7em;
  color: #aaa;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-align: right;
  padding: 2px 4px;
  user-select: none;
}
```

---

## Step 6 — `focus.root === null` guard

When `focus.root === null`:
- Right triangle is `disabled`
- Succ pane is hidden — `succAtomicDiagram` is `null`, so `{#if succAtomicDiagram}` hides it

Same visible behaviour as today. The size of the Succ `AtomicDiagramView` should match the Focus pane — pass the same `width` and `height` props (currently 380×340).

---

## Migration: examples unchanged

`diagramStore.svelte.ts` is initialised with `resetTo(withOuterFrame(boxtree()))` (called from `OpetopeBuilder`'s module init or an `$effect` that runs once). All four examples continue to work via `loadExample` which calls `resetTo`.

---

## Files modified

| File | Change |
|---|---|
| `frontend/lib/diagramStore.svelte.ts` | **NEW** — reactive store |
| `frontend/lib/validate.ts` | Add `validateStack`, `treeShapeEquals`; import `computeSucc` |
| `frontend/components/OpetopeBuilder.svelte` | Remove local state; call store; remove props from OpetopeEditor |
| `frontend/components/OpetopeEditor.svelte` | Read from store; replace Succ TreeDiagram → AtomicDiagramView; add arrows + dim badges |
| No changes to | `AtomicDiagramView.svelte`, `TreeDiagram.svelte`, `BoxDiagram.svelte`, `layout.ts`, `opetope.ts` |

---

## Later: thumbnail strip (not in scope now)

After dimension hopping is working: add a horizontal `<ThumbnailStrip>` component below the 3-pane editor. Each thumbnail is a small (non-interactive) `AtomicDiagramView` at scale ~0.3. Clicking a thumbnail sets `focusIdx` directly (no hop chain). The active thumbnail is highlighted. This requires `AtomicDiagramView` to accept a `scale` or `width`/`height` prop (it already does — they default to 380×340 but are configurable).
