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

### 4.5 Migrate from `dfx` to `icp-cli` (in progress)

> `dfx` is the legacy DFINITY SDK being sunsetted. The successor is `@icp-sdk/icp-cli`
> (installed as a dev dependency). Config lives in `icp.yaml` instead of `dfx.json`.
> Motoko compilation is already handled by `npx ic-mops build` — the only remaining
> dfx usage is canister/asset management wire protocol.

#### What we learned about `@icp-sdk/icp-cli` v0.2.2

**Package**: `@icp-sdk/icp-cli` (invoked as `icp` via npx or PATH)

**Command mapping (dfx → icp):**

| dfx command | icp equivalent |
|---|---|
| `dfx start --clean --background` | `icp network start -d` |
| `dfx stop` | `icp network stop` |
| `dfx canister install --wasm <file> --mode upgrade` | `icp canister install --wasm <file>` |
| `dfx deploy assets` | `icp sync assets -e local` |
| `dfx canister id <name>` | `icp canister id <name> -e local` |
| `dfx identity whoami` | `icp identity whoami` |

**Config format** (`icp.yaml`):
```yaml
networks:
  - name: local
    mode: connected          # connects to existing replica
    url: http://127.0.0.1:4943

environments:
  - name: local
    network: local
    canisters:
      - counter
      - assets

canisters:
  - name: counter
    # REQUIRED: must have a 'recipe' or 'build' section
    # (currently missing — causes parse error when using name-based install)
  - name: assets
    sync:
      steps:
        - type: assets
          dir: dist
```

**Known blockers (as of icp-cli 0.2.2 + dfx 0.31.0 replica):**

1. **`icp canister install` by name requires `recipe`/`build` in `icp.yaml`**
   - Error: `"Canister counter must have a 'recipe' or a 'build' section"`
   - Fix: either define a build section in `icp.yaml`, or install by principal ID

2. **Management canister IDL mismatch with dfx 0.31.0 replica**
   - Error when installing by principal ID with `--network http://127.0.0.1:4943 --root-key …`
   - `icp-cli` 0.2.2 doesn't know the `log_memory_store_size` field returned by dfx replica
   - **Root cause:** dfx 0.31.0 and icp-cli 0.2.2 have different management canister IDL versions
   - **Fix path:** Use `icp network start -d` (icp-cli's own replica) instead of dfx's replica

3. **No `--wasm-memory-persistence keep` equivalent yet**
   - dfx uses `--wasm-memory-persistence keep` for `persistent actor` upgrades
   - icp-cli 0.2.2 may not yet expose this flag; check release notes for 0.3.x+

#### Final working `icp.yaml` format

```yaml
networks:
  - name: local
    mode: managed        # icp-cli manages replica lifecycle
    bind: 127.0.0.1:4943 # NOTE: icp-cli ignores bind, starts on port 8000 by default

environments:
  - name: local
    network: local
    canisters:
      - counter
      - assets

canisters:
  - name: counter
    build:
      steps:
        - type: script
          commands:
            - npx ic-mops build
            - cp .mops/.build/counter.wasm "$ICP_WASM_OUTPUT_PATH"

  - name: assets
    recipe:
      type: "@dfinity/asset-canister@v2.1.0"
      configuration:
        dir: dist
    # NOTE: cannot combine recipe + sync sections; recipe handles sync via dir
```

#### Migration steps

- [x] Create `icp.yaml` with correct syntax
- [x] Switch replica: `icp network start local -d` (runs on port 8000, not 4943)
- [x] `icp build -e local` → builds counter WASM via `npx ic-mops build`
- [x] `icp canister create` + `icp canister install` → deploys both canisters
- [x] `icp sync assets -e local` → uploads `dist/` to assets canister
- [x] `package.json` updated: `start:local`, `stop:local`, `deploy:local` all use `icp`
- [x] Vite proxy updated: `/api` → `http://localhost:8000`
- [ ] Remove `dfx.json` and `dfx` from devDependencies once confirmed stable
- [ ] Note: canisters must be created once (`icp canister create`) before first install;
  IDs are stored in `.icp/` (gitignore this directory or commit canister IDs separately)

#### Remaining gap

- No `--wasm-memory-persistence keep` equivalent yet; `persistent actor` upgrades
  may need special handling — monitor icp-cli releases

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
