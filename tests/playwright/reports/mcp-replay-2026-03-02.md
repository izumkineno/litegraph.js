# Playwright MCP Replay Record (2026-03-02)

- Target page: `http://127.0.0.1:4173/editor/index.html`
- Runner mode: Playwright MCP browser control (`browser_navigate` + `browser_evaluate`)
- Final result: `5 passed / 0 failed`

## Scenario Results

1. `self-aware-scan`
- Status: `passed`
- Duration: `405ms`
- Key metrics: `regionCount=31`, `sampledCount=18`

2. `interactions-core`
- Status: `passed`
- Duration: `1769ms`
- Key metrics: `final nodeCount=4`, `final linkCount=0`

3. `canvas-pan-zoom`
- Status: `passed`
- Duration: `256ms`
- Key metrics: `scale 1 -> 1.1`, pan offset changed in middle/right drag flows

4. `context-menu-recursive`
- Status: `passed`
- Duration: `17200ms`
- Key metrics: `totalLeafCount=16` across `canvas/node/slot/link` root menus

5. `full-lifecycle-closure`
- Status: `passed`
- Duration: `4849ms`
- Key metrics: created `Const Number + Inner Slider + Watch`, final `nodeCount=2`, `linkCount=1`

## Assertion Scope Replayed

- Dynamic clickable region extraction (`visible_nodes`-driven, no hardcoded canvas coordinates)
- Node selection/move/rename/delete
- Slot connect and disconnect flows
- Widget interaction (`button/toggle/slider/combo`)
- Canvas pan/zoom and coordinate roundtrip checks
- Recursive context menu traversal and leaf action execution
- Per-step graph snapshot diff checks
- Runtime crash capture (`window.onerror`, `unhandledrejection`, draw patching)

## Artifacts

- Structured summary JSON: [mcp-replay-2026-03-02.json](/e:/Code/litegraph.js/tests/playwright/reports/mcp-replay-2026-03-02.json)

## Notes

- MCP console history contains exploratory errors generated before the final successful replay iteration.
- Final replay run itself completed with zero in-page runtime errors for all five scenarios.
