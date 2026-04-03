---
name: Multi-select deselect on Shift-click
description: Future UX: Shift-clicking a selected node should remove it and any other nodes that become ineligible
type: project
---

When a node is already selected, Shift-clicking it should deselect it **and** remove any other currently-selected nodes that are no longer part of a valid connected subtree without it.

**Why:** Symmetric to the "add and auto-extend" behaviour — removing a node may invalidate the selection, so the set should be trimmed to the largest remaining valid subset (or cleared entirely).

**How to apply:** Implement in `handleSelect` in `OpetopeEditor.svelte`: when `add=true` and `id` is already in `selectedIds`, remove it and recompute validity of the remainder via `isValidEncircleSet(focus.edgeRoot, remaining)`.

**Not yet implemented.**
