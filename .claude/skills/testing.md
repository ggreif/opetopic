# Testing skill

Run the frontend test suite.

```bash
npm test
```

The vitest config (`vitest.config.ts`) sets `resolve.extensions: ['.ts', ...]` so
TypeScript sources in `frontend/lib/` take priority over any stale compiled `.js`
files. If stale `.js` files somehow accumulate and cause confusion, clean them up with:

```bash
rm -f /Users/ggreif/opetopic/frontend/lib/*.js /Users/ggreif/opetopic/frontend/lib/*.js.map
```
