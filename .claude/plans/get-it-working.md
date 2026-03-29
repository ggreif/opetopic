# Opetopic: Get It Working Plan

**Branch:** `d3` (all work stays on this branch)
**Updated:** 2026-03-29
**dfx installed:** 0.31.0

---

## Priority 1 — Get working locally with `npm run dev` + VSCodium Simple Browser

### 1.1 Fix the broken `vite.config.mts`

> **Risk:** The current uncommitted change introduced a syntax error. The `defineConfig`
> callback has an orphaned `plugins: [svelte({ exclude: [...] })]` expression (no `return`,
> not assigned). The outer `const config` at line 51 also has `plugins: [svelte()]`.
> Two competing plugin entries will cause Vite to error or double-process Svelte files.

- [ ] Resolve the conflict: remove the bare `plugins` expression and consolidate into
  the `config` object's `plugins` array, passing the `exclude` option there:
  ```ts
  // in the config object:
  plugins: [svelte({ exclude: ['dist', 'src/app.html'] })],
  ```
- [ ] Remove the orphaned `plugins` block (introduced by the uncommitted change).
- [ ] Verify the `fileURLToPath(new URL('package.json', import.meta.url))` call is correct.
- [ ] Commit the `vite.config.mts` fix and the trivial `Layout.svelte` console.log removal
  as a single clean-up commit.

### 1.2 Fix `dfx.json` local network port

> **Risk:** dfx 0.31.0 starts the replica on `127.0.0.1:4943` by default.
> `dfx.json` still says `"bind": "127.0.0.1:8000"`. The Vite proxy already targets 4943.

- [ ] In `dfx.json`, update `networks.local.bind` from `127.0.0.1:8000` to `127.0.0.1:4943`.
- [ ] Optionally add `"dfx": "0.31.0"` to `dfx.json` to pin the SDK version.

### 1.3 Start the local IC replica and deploy canisters

- [ ] Run `dfx start --clean --background` from the project root.
- [ ] Verify the replica is reachable: `dfx ping local`.
- [ ] Run `dfx deploy` to build and deploy the `counter` and `assets` canisters locally.
- [ ] Verify `.dfx/local/canister_ids.json` is populated with `counter` and `assets` IDs.

### 1.4 Generate TypeScript declarations (replace deprecated `.dfx` import)

- [ ] Run `dfx generate` to create `src/declarations/counter/` with up-to-date JS bindings.
- [ ] In `frontend/App.svelte`, change any import from `../.dfx/local/canisters/counter`
  to `$declarations/counter`.
- [ ] Add `"baseUrl": "."` to `tsconfig.json` `compilerOptions` so the `$declarations`
  path alias resolves correctly (currently missing).

### 1.5 Verify `npm run dev` starts without errors

- [ ] Run `npm run dev` — Vite should start on `http://localhost:5173`.
- [ ] Open VSCodium Simple Browser to `http://localhost:5173`.
- [ ] Confirm the page loads: Layout.svelte D3+WebCola graph, Home.svelte welcome text,
  and all theory section components (Intro, Complexes, Opetopes, … Equivalences).
- [ ] Confirm no console errors related to `Buffer`, `global`, or IC agent.
- [ ] Confirm the Connect2IC wallet button renders (even if not connected).
- [ ] Check that `chris.json` is fetched correctly by the D3 visualisation in Layout.svelte.

### 1.6 Verify `npm run build` produces a clean `dist/`

- [ ] Run `npm run build` (runs `tsc && vite build`).
- [ ] Check `dist/index.html` exists.
- [ ] Add `chris.json` and `app.json` to `dfx.json` `canisters.assets.source` so they are
  included in the IC assets canister (currently only `dist/` is listed).
- [ ] Run `dfx deploy` after build to upload the latest `dist/` to the assets canister.
- [ ] Open the assets canister URL in Simple Browser to confirm the served build works.

---

## Priority 2 — Modernise JS/TS libraries

> **Strategy:** Upgrade lowest-risk / most isolated packages first. Test the build after
> each major upgrade. Treat Svelte 4→5 as the highest-risk migration — do it last.
>
> **All upgrades stay on branch `d3`.**

### 2.1 Safe minor upgrades (do first, low risk)

- [ ] `d3` 7.8.5 → 7.9.0:
  ```
  npm install d3@7.9.0 @types/d3@latest
  ```
  Re-run `npm run dev` and verify Layout.svelte visualisation.

- [ ] `prettier` + `prettier-plugin-svelte` → latest minors:
  ```
  npm install prettier@latest prettier-plugin-svelte@latest --save-dev
  ```
  Run `npx prettier --check frontend/` to confirm no regressions.

### 2.2 TypeScript 5.x patch upgrade (stay on 5.x for now)

> Stay on TypeScript 5.x — TypeScript 6.x breaks `svelte-preprocess` 6's
> peer dep (`typescript: ^5.0.0`) and may break `svelte-check` 3.x.

- [ ] Run `npm install typescript@~5.8 --save-dev`.
- [ ] Run `npx tsc --noEmit` and fix any new strict errors.

### 2.3 Vite 5 → 6 (intermediate step before eventual Vite 8)

> Vite 8 requires `@sveltejs/vite-plugin-svelte` 7, which requires Svelte 5.
> Stage through Vite 6 while still on Svelte 4.

- [ ] Run `npm install vite@^6 @types/node@^22 --save-dev`.
- [ ] Check `vite.config.mts` for any deprecated keys (consult Vite 6 migration guide).
- [ ] Run `npm run dev` and `npm run build` — confirm clean.

### 2.4 vitest 1 → 4

- [ ] Run `npm install vitest@^4 --save-dev`.
- [ ] Run `npx vitest run` — currently no test files, so confirm no config errors.

### 2.5 svelte-check 3 → 4

- [ ] Run `npm install svelte-check@^4 --save-dev`.
- [ ] Run `npx svelte-check` and address any new type errors.

### 2.6 `@dfinity/agent` 0.20.2 → 3.4.3 (BREAKING — careful)

> Key breaking changes:
> - `HttpAgent` constructor changed; use `HttpAgent.create()` factory.
> - `fetchRootKey()` must be awaited before creating actors in local dev.
> - `@dfinity/candid` and `@dfinity/principal` must be upgraded in lockstep.
> - `Buffer` polyfill in `index.html` may no longer be needed (agent ships its own).

- [ ] Run `npm install @dfinity/agent@3.4.3 @dfinity/candid@3.4.3 @dfinity/principal@3.4.3`.
- [ ] Run `dfx generate` again — regenerated declarations will use the new agent API.
- [ ] Check if the manual `Buffer` polyfill script in `index.html` can be removed.
- [ ] Remove `esbuildOptions.define: { global: 'globalThis' }` from `vite.config.mts`
  if agent 3.x no longer needs it.
- [ ] Update any direct `HttpAgent` usage in app code to `HttpAgent.create()` pattern.
- [ ] Run `npm run dev` and test counter canister interaction end-to-end.

### 2.7 `@connect2ic` — pin at 0.1.6, do NOT upgrade yet

> Latest is `0.2.0-beta.24` — still unstable, no stable release. Pin at 0.1.6 until a
> stable 0.2.x drops. If agent 3.x causes incompatibilities, evaluate switching to
> `@nfid/identitykit` or `@internet-computer/identity` (both have stable Svelte 5 support).

- [ ] Pin in `package.json`: change `"^0.1.1"` to `"0.1.6"` for both `@connect2ic` packages.
- [ ] Run `npm install` to lock these in `package-lock.json`.

### 2.8 Svelte 4 → 5 migration (HIGHEST RISK — do last)

> Key breaking changes affecting this codebase:
> - **Component instantiation:** `new App({ target })` → `mount(App, { target })` in `frontend/main.ts`.
> - **Reactive declarations:** `$: bonds = false` → `let bonds = $state(false)` in `Complexes.svelte`.
> - **Event directives:** `on:click={handler}` → `onclick={handler}` across components.
> - **`svelte-preprocess`:** Not needed in Svelte 5; remove it.
> - **`@connect2ic/svelte` 0.1.6:** Uses Svelte 4 stores — will work in Svelte 5 legacy
>   compatibility mode but may emit deprecation warnings.

- [ ] Run `npm install svelte@^5 @sveltejs/vite-plugin-svelte@^7 vite@^8 --save-dev`.
- [ ] Run `npm uninstall svelte-preprocess`.
- [ ] Run the official migration tool: `npx sv migrate svelte-5` — review all diffs carefully.
- [ ] Manually update `frontend/main.ts`:
  ```ts
  import { mount } from 'svelte'
  import App from './App.svelte'
  mount(App, { target: document.body })
  ```
- [ ] Optionally upgrade to TypeScript 6 now:
  ```
  npm install typescript@^6 --save-dev
  ```
- [ ] Run `npx svelte-check` and fix all type errors.
- [ ] Run `npm run dev` and do a full manual test of all 11 theory sections.
- [ ] Test the Connect2IC wallet button in Svelte 5 legacy mode; if broken, evaluate
  switching to `@nfid/identitykit`.

---

## Priority 3 — HTML cleanup + patch cherry-picks

> **Status:** Both patch-1 and patch-2 fixes are **already present** on the `d3` branch
> (the Svelte frontend equivalents). No cherry-picking is needed:
> - **patch-1** (typo "configuation→configuration"): fixed in the Svelte component.
> - **patch-2** (right-arrow nav link → `/docs/theory/units`): fixed in the Svelte component.
>
> The old Scala/Play templates in `opetopic-play/` are legacy and not served by the
> current Vite/IC build. They can be ignored or eventually removed.

### 3.1 General HTML / Svelte component cleanup

- [ ] Set a proper `<title>` in `index.html`: change "Vite App" to "Opetopic".
- [ ] Remove or replace Dfinity boilerplate from `frontend/App.svelte` (logo, template text).
- [ ] Remove commented-out `<Counter />`, `<Profile />`, `<Transfer />` examples from
  `App.svelte` if they are not part of the opetopic UI.
- [ ] Consider whether IC wallet (Connect2IC) belongs in the main layout or a separate page.
- [ ] Fix all internal `/docs/…` hrefs in Svelte components — they use Play framework routes
  that don't exist in the SPA. Either add a client-side router (e.g. `svelte-spa-router`)
  or convert to anchor/scroll links within the single-page layout.
- [ ] Verify all 52 SVG components in `frontend/components/svgs/` render correctly after
  any Svelte migration.

### 3.2 Improve dev experience for VSCodium Simple Browser

- [ ] Add a `.env.development` file documenting required env vars:
  ```
  DFX_NETWORK=local
  ```
- [ ] Add `npm run check` script to `package.json`:
  ```json
  "check": "svelte-check --tsconfig tsconfig.json"
  ```
- [ ] Ensure `.gitignore` covers `dist/`, `.dfx/`, `src/declarations/` (generated files).

---

## Priority 4 — IC mainnet deployment (next steps)

> **Prerequisite:** Complete Priorities 1–3 first.

### 4.1 Pre-deployment checklist

- [ ] Confirm the deployment identity: `dfx identity whoami`.
  Known identities: `Beeah-Group`, `BraGov`, `CanHell`, `Lata`, `Offsetter`.
- [ ] Confirm the identity has a cycles wallet: `dfx wallet balance --network ic`.
- [ ] Run `npm run build` and verify `dist/` is complete.

### 4.2 First mainnet deploy

- [ ] Run `dfx deploy --network ic`.
- [ ] Commit the generated `canister_ids.json` (project root) to the `d3` branch.
- [ ] Note the assets canister URL: `https://<assets-canister-id>.ic0.app`.
- [ ] Test in a browser: all sections load, SVGs render, D3/WebCola graph works.

### 4.3 Custom domain (optional)

- [ ] Configure via IC boundary node DNS TXT record mechanism.
  See IC docs: Custom domains for frontend canisters.

### 4.4 CI/CD (optional)

- [ ] Add a GitHub Actions workflow (`.github/workflows/deploy.yml`) that:
  1. Installs dfx via `DFX_VERSION` env var.
  2. Runs `npm ci && npm run build`.
  3. Deploys to IC mainnet on push to `main`.
- [ ] Reference the existing CircleCI config at `origin/circleci` branch for patterns.

---

## Upgrade order summary

```
d3@7.9.0                        ← safe, do first
prettier (minor)                ← safe
typescript@~5.8                 ← stay on 5.x for now
vite@^6                         ← before Svelte 5 (Vite 8 requires plugin-svelte 7)
vitest@^4                       ← independent
svelte-check@^4                 ← independent
@dfinity/agent@3.4.3            ← breaking but isolated; before Svelte 5
@connect2ic PIN at 0.1.6        ← do NOT upgrade (beta only)
svelte@^5 + plugin-svelte@^7    ← LAST; highest risk; use `npx sv migrate svelte-5`
vite@^8                         ← bundled with svelte@5 + plugin@7 upgrade
typescript@^6                   ← after Svelte 5 (optional)
```

---

## Known risks and gotchas

| Risk | Severity | Mitigation |
|---|---|---|
| `vite.config.mts` orphaned `plugins` expression | HIGH | Fix immediately in Priority 1.1 |
| Svelte 4→5 `new App()` → `mount()` | HIGH | Auto-migrated by `npx sv migrate svelte-5`; verify |
| `@connect2ic` 0.1.6 on Svelte 5 | MEDIUM | Test in legacy compat mode; fallback: identitykit |
| `@dfinity/agent` 0.x→3.x API changes | MEDIUM | Regenerate declarations; update HttpAgent usage |
| `dfx.json` port 8000 vs 4943 | MEDIUM | Fix in Priority 1.2 |
| `src/declarations/` missing (`$declarations` alias broken) | MEDIUM | Run `dfx generate` after deploy |
| `chris.json` not in IC assets canister | LOW | Add to `dfx.json` sources |
| Internal `/docs/…` hrefs broken in SPA | LOW | Add routing or convert to scroll anchors |
| `tsconfig.json` missing `"baseUrl"` | LOW | Add `"baseUrl": "."` for path aliases |
