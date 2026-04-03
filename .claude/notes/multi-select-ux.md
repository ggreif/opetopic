---
name: Multi-select deselect on Shift-click
description: Future UX: Shift-clicking a selected node should remove it and any other nodes that become ineligible
type: project
---

When a node is already selected, Shift-clicking it should deselect it **and** remove any other currently-selected nodes that are no longer part of a valid connected subtree without it.

**Why:** Symmetric to the "add and auto-extend" behaviour — removing a node may invalidate the selection, so the set should be trimmed to the largest remaining valid subset (or cleared entirely).

**How to apply:** Implement in `handleSelect` in `OpetopeEditor.svelte`: when `add=true` and `id` is already in `selectedIds`, remove it and recompute validity of the remainder via `isValidEncircleSet(focus.edgeRoot, remaining)`.

**Not yet implemented.**

## Known layout glitch: sibling nodes overlap intermediate box

When encircling a multi-node set (e.g. {j, i} in the boxtree), non-encircled siblings whose edge-tree position falls geometrically between the selected nodes get visually swallowed by the wrapper bounding rect.

Root cause: `intermediateBoxes` in `AtomicDiagramView.svelte` computes bounds post-layout (bounding rect of selected nodes ± INTER_PAD). Non-selected nodes that happen to sit spatially between selected nodes are not pushed outside.

Fix needed: pass intermediate box membership into `computeLayout` (layout.ts) so non-enclosed nodes can be fenced outside wrapper bounds — similar to the existing clearance fence system for drops.
