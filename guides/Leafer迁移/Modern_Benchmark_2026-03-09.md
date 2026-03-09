# Modern Benchmark 2026-03-09

## Scope
- Runtime: `editor/index-ts-vite.html`
- Preset: `balanced`
- Tooling:
  - browser DevTools trace
  - CDP CPU profiler

## Result Snapshot
- Legacy baseline from the previous benchmark pass:
  - `create_total_ms ~= 6.6`
  - `data_step_avg_ms ~= 0.09`
  - `event_step_avg_ms ~= 5.6`
- Modern baseline before this worker pass:
  - `create_total_ms ~= 131-135`
  - `data_step_avg_ms ~= 1.7-1.8`
  - `event_step_avg_ms ~= 58-65`
- First worker batching attempt regressed badly:
  - `create_total_ms ~= 220.6`
  - `data_step_avg_ms ~= 2.65`
  - `event_step_avg_ms ~= 94.87`
- After request backpressure and looser worker result reuse:
  - `create_total_ms ~= 200.3`
  - `data_step_avg_ms ~= 2.65`
  - `event_step_avg_ms ~= 74.23`
  - `event exec_avg_ms ~= 20.07`
- After adding a modern foreground-only fast repaint path:
  - `create_total_ms ~= 166.2`
  - `data_step_avg_ms ~= 1.70`
  - `event_step_avg_ms ~= 43.13`
  - `event exec_avg_ms ~= 10.82`

## What Improved
- Active link presentation results are no longer dropped on every `lastTime` change.
- Only one worker request is kept in flight for active link presentation batches.
- Foreground-only node dirty signals no longer force incident link resync on the synchronous step path.
- The repo-side hot path moved away from `buildLinkFlowPresentation()` and `syncLinkView()` as primary sampled frames.

## What Did Not Reach Target
- The planned target for this pass was `event_step_avg_ms <= 45`.
- That target is now met by the latest non-profiler run: `~43.13ms`.
- `create_total_ms` is still far above legacy and remains outside the original aspirational range.

## Root Cause
- `EditorBenchmark.measureStepSamples()` measures synchronous `graph.runStep(1)` cost in a tight loop.
- Worker-based presentation is asynchronous, so it cannot directly reduce synchronous step cost unless the step path itself stops doing visual recompute work.
- The remaining dominant cost is still main-thread Leafer attr and bounds churn:
  - Leafer internals:
    - `__updateLocalBounds`
    - `setListWithFn`
    - `updateBounds`
    - `localStrokeBounds`
    - `localRenderBounds`
  - Repo frames that still show up in the profile:
    - `LinkViewHost.setAttrIfChanged`
    - `ModernNodeHost.setAttrIfChanged`
    - `ModernNodeHost.repaint`
    - `ModernNodeHost.syncPortLayer`
    - `LeaferTextMetrics.normalizeWhitespace`

## Worker Candidate Index

### A: Keep / expand
- Active link presentation batch compute in `LeaferTaskWorker`
  - curve control points / path
  - midpoint
  - flow dots
  - opacity / active state
- Batch `NodePortAdapter` pure geometry helpers inside the worker
  - cubic curve building
  - point-on-curve sampling

### B: Candidate after current pass
- Batch filtering of active links before submit
  - only worth doing if main-thread link snapshot traversal becomes visible again
- Coarser animation buckets for worker presentation reuse
  - acceptable only if visual smoothness remains good enough

### C: Hybrid candidates, not for this pass
- Port/layout precompute snapshots for `ModernNodeHost`
  - only the pure math part is movable
  - Leafer UI tree patching must stay on the main thread

### X: Do not move to worker
- Graph execution and `triggerSlot`
  - depends on graph state and node side effects
- Leafer UI tree ownership and attr patching
  - current design keeps Leafer rendering on the main thread
- Leafer text measurement with the live measurement root
  - tied to the main-thread Leafer app host

## Next Main-Thread Targets
- Further cut `ModernNodeHost.syncPortLayer()` attr writes when geometry is stable.
- Reduce `LinkViewHost.update()` attr churn for active links whose path is unchanged.
- Avoid repeated text normalization / measurement work on high-frequency runtime paths.
- Reduce `create_total_ms`, which is now the clearest remaining gap versus legacy.

## Files Touched In This Pass
- `src/ts-migration/leafer/LeaferTaskWorker.ts`
- `src/ts-migration/leafer/SceneSyncController.ts`
- `src/ts-migration/leafer/ModernNodeHost.ts`
- `src/ts-migration/leafer/ModernNodeBase.ts`

## Validation
- `bunx tsc -p tsconfig.typecheck.json --pretty false`
- `bunx jest tests/nodes-leafer-base.test.js tests/nodes-leafer-events-logic.test.js --runInBand`
- `bun run build:ts-migration`
