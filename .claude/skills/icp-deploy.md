# ICP Local Deploy

## One-time setup

npm's global prefix points to the nix store (read-only), so redirect it first:

```bash
npm config set prefix ~/.npm-global
npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm
export PATH=~/.npm-global/bin:$PATH
```

Verify: `icp --version` should print `icp 0.2.2` (or later).

Add the export to `~/.zshrc` if you want it persistent.

## Deploy workflow

The simplest way — everything is wired into a single npm script:

```bash
npm run deploy:local
```

This chains: build Motoko canisters → install counter → `npm run build` (Svelte) → install
assets canister → sync assets. Equivalent to the manual steps below and preferred for
day-to-day use.

### Manual equivalent

```bash
export PATH=~/.npm-global/bin:$PATH   # if not already in PATH

icp network start -d                  # starts local replica on port 8000
npm run build                         # build the Svelte frontend first
icp deploy                            # create/sync canisters + upload assets
```

After deploy, two URLs are printed:
- **Frontend**: `http://assets.local.localhost:8000/`
- **Candid UI**: `http://tqzl2-p7777-77776-aaaaa-cai.localhost:8000/?id=<counter-canister-id>`

## Stop

```bash
icp network stop
```

## Pitfalls encountered

- `npx icp-cli` is a different (older, deploy-only) package — no `network start`
- `ic-mops toolchain install` is broken in recent versions due to `@icp-sdk/core` peer dep conflicts with `@dfinity/*` packages — avoid touching it
- `moc` is already installed by mops at `1.4.0`; `icp` finds it automatically
- Stale network descriptor warning on restart is harmless — `icp` cleans it up automatically
