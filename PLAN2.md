# Modern Leafer 性能优化执行计划

## Status Update 2026-03-09
- [x] `ModernNodeHost.syncPosition()`、`syncContentLayout()`、widget/action-part layer visibility 已补成字段级 diff，继续压缩高频重复 attr 写入
- [x] Added first-stage Leafer background task worker infrastructure for non-blocking visual sampling; current integration offloads active link flow-dot sampling without moving the full App/interaction stack off the main thread
- [x] Runtime animation frames now return merged dirty bounds in `SceneSyncController`, so transient node/link updates prefer partial `forceRender(bounds)` instead of unconditional full-scene render
- [x] Active link animation now reuses cached curve geometry in `SceneSyncController`, avoiding per-frame `getLinkCurve()` / midpoint recompute while nodes stay still
- [x] `LinkViewHost` now patches stroke/flow/dot attrs by diff instead of unconditional writes on every sync
- [x] `ModernNodeHost.repaint()` now promotes geometry passes from shell/widget/action-part signature diffs, not only raw `Layout/Ports` mask bits
- [x] Pure `Data/Style` updates now keep port visual sync alive without forcing port geometry cache invalidation
- [x] Widgets and action parts now reuse cached layout snapshots when geometry is stable, reducing rebuild/reflow pressure on value-only updates
- [x] `ModernNodeHost` now caches shell text metrics (`title` / `headerMeta`) and cached content-area geometry to avoid duplicate measurement across layout and patch stages
- [x] Interaction-state hot paths now use diff-patched attr writes for shell, widget, and action-part hover/press updates
- [~] Next focus: keep reducing `applyShellLayout` churn and then move to `updateIncidentLinks()` / `updateFlowOverlay()` secondary costs
- [x] Leafer 文本测量服务已接入 `ModernNodeHost`、`ModernNodeAuthoringUtils`、`nodes_leafer/base/shared/runtime.js`
- [x] 连接预览已从 offscreen canvas 改为 Leafer `Path`
- [x] 连线已接入 `@leafer-in/arrow`
- [x] `ModernNodeHost` 已完成第一版 port presentation / geometry / gutter cache
- [x] `applyShellLayout()` 与 `syncPortLayer()` 已完成第一版字段级 diff patch
- [x] `syncPosition()` 与 `syncContentLayout()` 已完成字段级 diff patch，避免 repaint 时重复写入相同位置/尺寸
- [~] `repaint()` 已开始按 `ModernNodeChangeMask` 分流
  - 当前 `Data` 路径不再无条件触发 `ensureMinimumNodeSize()`、`computeShellLayout()`、`syncPorts()`、`syncContentLayout()`
  - 下一步继续细化 widget / action parts / shell text 的 mask 分流

## Summary
- 目标固定为两件事一起落地：
  1. 消除 modern 节点热路径里的文本测量、端口布局和 shell attr 抖动
  2. 清理纯 Leafer 路径中残留的 `document.createElement("canvas")` 与原始 2D 离屏绘制
- 范围固定为 `Modern + Overlay`：
  - 包含 `ModernNodeHost`、`ModernNodeAuthoringUtils`、`src/nodes_leafer/base/shared/runtime.js`、`OverlayPrimitives`
  - 排除 `LegacyNodeHost` / `LegacyNodePainter` 这类 legacy bitmap 兼容路径
- 当前 benchmark 基线仍按最初 trace 结论作为对照：
  - modern `balanced`: `create_total_ms ≈ 79.8`
  - modern `balanced`: `event_step_avg_ms ≈ 55.4`
  - 主要热点仍是 `measureTitleWidth`、`measureTextWidth`、`measurePortGutter`、`resolvePortPresentation`、`applyShellLayout`、`syncPortLayer`

## Current Status

### 已完成
- [x] 建立 Leafer 原生文本测量服务
  - 新增 `src/ts-migration/leafer/LeaferTextMetrics.ts`
  - 使用共享 `Text` probe + Leafer bounds 做测量
  - 提供无 host 时的近似值 fallback，不再回退到 DOM canvas
- [x] 在 `LeaferAppHost` 挂 measurement root
  - `src/ts-migration/leafer/LeaferAppHost.ts`
  - runtime 销毁时会 detach measurement root
- [x] 暴露内部统一测量 hook
  - `LiteGraph.__leaferMetrics.measureTextWidth(...)`
  - 接入点在 `src/ts-migration/index.ts`
- [x] 替换 modern 路径的 canvas 文本测量
  - `src/ts-migration/leafer/ModernNodeHost.ts`
  - `src/ts-migration/leafer/ModernNodeAuthoringUtils.ts`
  - `src/nodes_leafer/base/shared/runtime.js`
- [x] 去掉连接预览的 offscreen canvas
  - `src/ts-migration/leafer/OverlayPrimitives.ts`
  - `connectionPreview` 已从 Leafer `Canvas` 改成 Leafer `Path`
- [x] 连线层接入 `@leafer-in/arrow`
  - `src/ts-migration/leafer/LinkViewHost.ts`
  - `src/ts-migration/leafer/SceneSyncController.ts`
  - 保留现有 cubic bezier `path` 几何，不改 `NodePortAdapter`
- [x] 基础验证已通过
  - `bunx tsc -p tsconfig.typecheck.json --pretty false`
  - `bunx jest tests/nodes-leafer-base.test.js tests/nodes-leafer-events-logic.test.js --runInBand`
- [x] 后续增量验证已通过
  - `bun run build:ts-migration`

### 未完成
- [ ] `ModernNodeHost.repaint()` 热路径拆分
  - 现状：`Data` 变更仍会触发完整 `ensureMinimumNodeSize -> computeShellLayout -> syncPorts -> applyShellLayout`
  - 目标：拆成 `geometry`、`visual`、`interaction`、`widgets-data` 四条路径
- [ ] 端口两级缓存
  - `presentation cache`: `label/shape/dir/color/hideLabelWhenCollapsed`
  - `geometry cache`: `anchor/gutter/measuredLabelWidth`
  - 现状：`resolvePortGutters()` 仍会反复进入 `measurePortGutter()` 与 `resolvePortPresentation()`
- [ ] `applyShellLayout()` 字段级 diff
  - 现状：header/body/title/meta/summary/outline/resize 大量无差别 attr 写入
  - 目标：仅在值变化时写入 Leafer attr
- [ ] `syncPortLayer()` 增量 patch
  - 现状：端口位置、label、marker 颜色仍会重复写入
  - 目标：只在 marker shape、label text、anchor、active color 变化时更新
- [ ] link flow overlay 二次收敛
  - 现状：`updateIncidentLinks()` 与 `updateFlowOverlay()` 仍是次级开销点
  - 目标：减少无差别 path/flow dot 刷新
- [ ] 静态守卫
  - 目标：对 `src/ts-migration/leafer/**` 与 `src/nodes_leafer/**` 增加纯 Leafer 路径禁止 `document.createElement("canvas")` 的自动检查
- [ ] 文档持久化
  - 目标文件：`guides/Leafer迁移/Leafer_Modern_性能瓶颈与去Canvas优化计划.md`
  - 还需在 `src/ts-migration/README.md` 与 `src/ts-migration/DECOUPLING_PERFORMANCE_ROADMAP.md` 挂入口
- [ ] 性能复测
  - 需要重新跑 benchmark panel 和 DevTools trace
  - 输出新的 `create_total_ms` / `event_step_avg_ms` 对照

## Implementation Changes

### Phase 1: Leafer 原生文本测量基础设施
- [x] 新增 `LeaferTextMetrics`
- [x] `LeaferAppHost` 持有 measurement root
- [x] `ModernNodeHost` / `ModernNodeAuthoringUtils` / `nodes_leafer runtime` 统一接入
- [x] 无 host fallback 使用近似值，不再使用 DOM canvas

### Phase 2: 重构 `ModernNodeHost` 热路径
- [ ] `repaint()` 拆成确定的 4 条路径：`geometry`、`visual`、`interaction`、`widgets-data`
- [ ] `Data` 变更只更新：
  - widget 当前值
  - summary/title/meta 等局部文本内容
  - 局部状态色值
- [ ] `Data` 变更禁止触发：
  - `ensureMinimumNodeSize()`
  - `resolveMinimumShellWidth()`
  - `measurePortGutter()`
  - ports 几何重算
  - port layer 重建
- [ ] 为 ports 建立两级缓存
- [ ] `syncPortLayer()` 改成增量 patch
- [ ] `applyShellLayout()` 改成字段级 diff 写入
- [ ] shell 几何继续维持手写布局，不让 `@leafer-in/flow` 进入高频主路径

### Phase 3: 纯 Leafer 连线/预览路径
- [x] `OverlayPrimitives.connectionPreview` 已从 `Canvas` 改成 `Path`
- [x] 删除 `offscreenCanvas / offscreenContext / drawImage / paintConnectionPreview()` 旧链路
- [x] `LinkViewHost` 已接入 `@leafer-in/arrow`
- [ ] 继续优化 `updateIncidentLinks()` 和 `updateFlowOverlay()`，减少次级刷新成本

### Phase 4: 约束与文档收口
- [x] 纯 Leafer 文本测量已不再使用 `document.createElement("canvas")`
- [ ] 增加自动扫描守卫
- [ ] 输出专题文档并接入 `README` / roadmap

## Important API / Internal Contract Changes
- 已落地：
  - `LiteGraph.__leaferMetrics.measureTextWidth(...)`
  - `LeaferAppHost` 持有 measurement root
  - `OverlayPrimitives` 的连接预览内部实现从 `Canvas` 改为 `Path`
- 仍待固化：
  - `ModernNodeChangeMask`
    - `Data` 只 patch 值
    - `Style` 只 patch 视觉样式
    - `Layout` / `Ports` 才允许重算最小尺寸、gutter、anchor 和 port layer

## Test Plan

### 已完成
- [x] TypeScript typecheck
- [x] `nodes_leafer` 基础逻辑测试

### 待补齐
- [ ] 文本测量服务单测
  - 相同 `font + text` 命中缓存
  - 不同 `font` 或不同文本正确失效
  - 无 host 时返回近似值但不触发 canvas
- [ ] `resolveCollapsedWidth()` 对齐测试
  - TS 和 JS runtime 结果一致
- [ ] `ModernNodeHost` 热路径测试
  - `Data` mask 不触发 geometry 级方法
  - `Ports/Layout` 才会重算 gutter / anchor / port schema
- [ ] `OverlayPrimitives` 预览路径测试
  - preview path 更新正确
  - hide 后不可见
  - 缩放和平移后 world transform 同步正确
- [ ] 静态守卫测试
  - 扫描纯 Leafer 路径中是否出现 `document.createElement("canvas")`
- [ ] benchmark / trace 复测
  - `measureTitleWidth` 不再作为热点
  - `measureTextWidth` 不再是头部热点
  - `create_total_ms` 和 `event_step_avg_ms` 相比当前基线有明确下降

## Latest Pass 2026-03-09
- `ModernNodeHost.applyShellLayout()` now reuses cached shell text metrics and cached content-area geometry instead of recomputing them in every patch path
- `computeShellLayout()` and `resolveMinimumShellWidth()` now share the same `title` / `headerMeta` measurement cache
- `applyInteractionState()` / `applyWidgetInteractionState()` / `applyActionPartInteractionState()` now avoid redundant Leafer attr writes in hover and press loops
- Validation rerun passed:
  - `bunx tsc -p tsconfig.typecheck.json --pretty false`
  - `bunx jest tests/nodes-leafer-base.test.js tests/nodes-leafer-events-logic.test.js --runInBand`
  - `bun run build:ts-migration`

## Execution Order
1. 先做 `ModernNodeHost` 的 port presentation / geometry cache。
2. 再做 `applyShellLayout()` 和 `syncPortLayer()` 的字段级 diff patch。
3. 然后把 `repaint()` 真正拆成 `Data` 与 `Layout/Ports/Style` 分流。
4. 最后补静态守卫、文档和 benchmark 复测。

## Assumptions
- 本轮仍然以“性能优先”交付，不追求 shell 布局体系重构。
- `LegacyNodeHost` / `LegacyNodePainter` 继续允许使用 canvas。
- `src/nodes/graphics.js` 这类 legacy 节点文件不在本计划的“纯 Leafer 禁 canvas”范围内。
- 当前工作区里的 `.tmp-*` trace 文件只作为临时复现材料，不纳入实现依赖。
