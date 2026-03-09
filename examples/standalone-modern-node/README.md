# Standalone Modern Node Module

This example shows the standalone Modern node package contract introduced by the Leafer runtime:

- TS source only imports types from `litegraph.js/modern-types`
- runtime code exports `moduleDef` and `install(host?)`
- the IIFE build auto-registers when `globalThis.LiteGraph` is available
- when LiteGraph loads later, the module is replayed from the pending module queue

## Files

- `ts-counter-node.ts`: typed module definition example
- `js-counter-node.js`: plain JS module definition example
- `vite.config.mjs`: dual-output example (`es` + `iife`)

## Build

```bash
npx tsc -p examples/standalone-modern-node/tsconfig.json
npx vite build --config examples/standalone-modern-node/vite.config.mjs
```

## Runtime contract

The bundle must expose:

- `moduleDef`
- `install(host?)`

The IIFE build should also invoke `autoInstall(moduleDef)` as a side effect.
