# Migration TODO: Play → Svelte gaps

Audit date: 2026-03-29. Reference: `opetopic-play/app/views/` and `opetopic-play/app/assets/svgs/`.

---

## Doc pages — not yet migrated

These Play templates in `opetopic-play/app/views/docs/` have no Svelte equivalent:

- [ ] `basicediting.scala.html` → missing Svelte component
- [ ] `tutorial.scala.html` → missing Svelte component
- [ ] `typetheory.scala.html` → missing Svelte component
- [ ] `hdts.scala.html` → missing Svelte component
- [ ] `srccoh.scala.html` → missing Svelte component (also needs 9 SVGs from srccoh/ subfolder)
- [ ] `svg.scala.html` → missing Svelte component

The wrapper `docs/doc.scala.html` (layout/nav for all doc pages) also has no direct Svelte equivalent — currently the doc sections are rendered inline in `App.svelte`.

---

## Interactive applications — not migrated at all

These are the actual proof assistant tools. No Svelte equivalent exists for any of them:

- [ ] `playground.scala.html` — UI playground, accordion menu, shape selection
- [ ] `sketchpad.scala.html` — main editor: save/load, properties panel, viewer
- [ ] `prover.scala.html` — code editor (CodeMirror), module management
- [ ] `addrexplorer.scala.html` — address explorer with TOC and visualization
- [ ] `multiedit.scala.html` — multi-cell editor
- [ ] `coloredit.scala.html` — color editing tool
- [ ] `mtt.scala.html` — monotyped theory tool with TOC
- [ ] `stable.scala.html` — stable editor

---

## Authentication pages — not migrated

- [ ] `signIn.scala.html` → no Svelte equivalent
- [ ] `signUp.scala.html` → no Svelte equivalent

(These may become irrelevant if IC identity/wallet replaces Play's user auth.)

---

## SVGs — present in Play, missing in Svelte

51 SVGs in `opetopic-play/app/assets/svgs/` have no counterpart in `frontend/components/svgs/`.

### Needed by currently-migrated doc pages (higher priority)

- [ ] `newzoomreveal.svg` — used in Complexes (bond reveal toggle)
- [ ] `uprops1.svg` … `uprops6.svg` + `uprops-ext.svg` — UniversalProperties page
- [ ] `sprops1.svg` … `sprops6.svg` + `sprops-ext.svg` — UniversalProperties page
- [ ] `lext1.svg`, `lext2.svg`, `rext1.svg`, `rext2.svg` — Extrusions page extras
- [ ] `leftextension.svg`, `rightextension.svg` — Extrusions/Geometry
- [ ] `luniv2.svg`, `lunivmk.svg`, `runiv2.svg`, `runivmk.svg` — UniversalProperties
- [ ] `zoom.svg`, `zoom-left.svg`, `zoom-right-1.svg` — Complexes/Geometry
- [ ] `composition.svg`, `comps1.svg`, `comps2.svg`, `comps-exist.svg`, `comps-ext.svg` — OpetopicCategories
- [ ] `globsimp.svg` — unknown page (likely Geometry or Categories)
- [ ] `opex1.svg` — Extrusions or OpetopicSets
- [ ] `eqvs-src-1.svg`, `eqvs-src-2.svg`, `eqvs-tgt-1.svg`, `eqvs-tgt-2.svg` — Equivalences extras
- [ ] `x-drop.svg` — unknown page

### Needed only by unmigrated doc pages (lower priority)

- [ ] `alpha-def.svg`, `beta-def.svg`, `gamma-def.svg`, `epsilon-def.svg` — srccoh page
- [ ] `delta-def.svg` — srccoh page
- [ ] `f-def.svg` — srccoh page (units version already ported as `FDef.svelte`)
- [ ] `g-def.svg`, `g-univ.svg` — srccoh page
- [ ] `goal.svg` — srccoh page

### Unclear purpose (possibly drafts/unused)

- [ ] `temp1.svg`, `temp2.svg`, `temp3.svg`

---

## SVGs — in Svelte but not in Play (extras, probably fine)

These exist in `frontend/components/svgs/` but have no `.svg` counterpart in Play:

- `LeftExtrusion.svelte` — likely covers `leftextension.svg`
- `RightExtrusion.svelte` — likely covers `rightextension.svg`
- `unitright.svelte` — home page diagram, custom component

Verify these are intentional renames/consolidations before removing.

---

## Summary counts

| Category | Play | Svelte | Missing |
|---|---|---|---|
| Doc pages | 17 | 10 | 7 |
| App pages | 8 | 0 | 8 |
| Auth pages | 2 | 0 | 2 |
| SVGs | 101 | 52 (+3 extras) | 51 |
