
# Modern Leafer 掉帧修复计划

## Summary

- 目标是修复 modern Leafer runtime 下明显增加的掉帧，并把与其同源的性能问题一并收口：`event-runtime` 连线动画、节点 transient 动画扫描、以及 link view 的创建/清理开销。
- 根因已基本锁定为 runtime 动画期间的大量 Leafer attr/update churn，而不是 viewport 限制或 `start(0)` 调度壳本身。
- 当前主热点是 `SceneSyncController.refreshActiveLinkAnimations()` 驱动的 active link 全量刷新，以及 `LinkViewHost.updateFlowOverlay()` 对 flow path + 5 个 dot 的逐帧 attr 写入。
- 方案基准固定为“性能优先 + 贴合 Leafer”：
  - 不用 `maxFPS` 或全局节流掩盖问题
  - 不把 Leafer UI 树移到 Worker
  - 允许明显简化连线动画视觉，只保留最小运行反馈

## Implementation Changes

### 1. 把连线 runtime 动画从“流动 dots”降级为“短时高亮 path”

- `LinkViewHost` 的 runtime flow 视觉固定改成单条 overlay path 高亮，不再渲染 per-link `Rect` dots。
- 删除 `flowDotLayer`、`flowDots` 和对应的逐帧 `x/y/width/height/cornerRadius/visible` attr patch；link host 只保留 base stroke path 和一个简化后的 `flowPath`。
- `flowPath` 不再带箭头；箭头只保留在基础 `strokePath` 上，避免重复箭头绘制和额外 attr churn。
- active link 可视时长固定从 `1000ms` 改为 `180ms`。这次修复不追求 legacy 视觉一致性，优先收缩同时活跃的连线数量。
- opacity 固定做 6 桶线性量化，只在 bucket 变化时更新一次 `flowPath.opacity`，避免每帧写入连续浮点值。
- `SceneSyncController.buildLinkFlowPresentation()` 与 worker 返回结果都不再生成 `dots`；主线程只消费 `active + opacityBucket/opacity` 这类稳定结果。

### 2. 把 active link 追踪改成增量集合，移除热路径里的全链路扫描

- `LGraphNode.execution.triggerSlot()` 在写入 `link_info._last_time` 时，新增内部 runtime 记录：直接把触发的 `linkId` 标记到图级 dirty-link 集合。
- `LGraph.lifecycle / LGraph.execution` 新增与 dirty node 对应的 dirty link 收集与消费链路，`flushRuntimeExecutionRender()` 一次性把 node/link runtime dirty snapshot 扇出给 Leafer canvas。
- `LGraphCanvas.requestRuntimeRender()` 与 `SceneSyncController.requestRuntimeAnimation()` 内部协议扩展为同时接收 dirty `linkIds`；这属于内部 contract，不对外暴露新 LiteGraph API。
- `SceneSyncController` 不再在 `requestRuntimeAnimation()` 或 runtime frame 里调用 `collectActiveLinks()` 扫描全图 `linksById`。改为：
  - 用传入的 dirty `linkIds` 增量激活 `activeLinkIds`
  - 仅遍历当前 active set 做到期判定和视图更新
  - link 过期、删除、清空 triggered slots 时再从 active set 移除
- `clearTriggeredSlots()` 在将 `_last_time` 归零时，也要把对应 link 标记为 runtime dirty，确保高亮能立即消失，而不是等到下一轮被动过期。

### 3. 节点 transient 动画改成增量追踪，去掉每帧全节点扫描

- 保持节点执行灯视觉语义不变，`execute_triggered/action_triggered` 仍维持现有 2 帧寿命，不在本轮通过“缩到 1 帧”偷性能。
- `SceneSyncController` 不再通过 `hasAnyTransientNodeAnimation()` 和 `captureActiveTransientNodeIds()` 每帧扫描全部 `nodesById`。
- 改为维护增量 `activeTransientNodeIds` 集合：
  - 上游 `requestRuntimeAnimation(nodeIds)` 传入的 dirty 执行节点直接进入 active set
  - `repaintAnimatedNodes()` 只遍历 active set 和 `pendingSettledNodeRepaints`
  - 当 `execute_triggered/action_triggered` 衰减到 0 时，把节点移出 active set，并做一次 settled repaint
- `requestRuntimeAnimation()` 的 `hasPendingNodeFrames` 判定改为基于 active set 和 settled set，禁止再用全图扫描判断“是否还有动画”。

### 4. 收紧 link presentation worker 和主线程 patch 协议

- `LeaferTaskWorker` 的 active-link 批处理结果固定改为只返回：
  - `linkId`
  - `layoutKey`
  - `active`
  - 量化后的 `opacity` 或 `opacityBucket`
  - `curve`
  - `midpoint`
- 移除未使用的 `sample-link-flow-dots` 任务、`requestLinkFlowSample()`、`dotCount` 参数和结果里的 `dots` 字段，避免多余序列化和维护成本。
- `SceneSyncController.handleActiveLinkPresentationResult()` 只在 `layoutKey` 或 `opacityBucket` 变化时才更新缓存并触发 `syncLinkView()`；同一条 link 在同一 bucket 内禁止重复 patch。
- `syncLinkMidpointToPoint()` 只在几何布局变化时执行，不再随着 runtime opacity tick 反复写 midpoint。

### 5. 把 Leafer render 触发收敛到“有实际 patch 才请求渲染”

- runtime 动画路径里，`handleRuntimeAnimationFrame()`、worker 结果回调、node settled repaint 都只在本轮确实应用了 node/link patch 时才调用 `requestSceneRender(...)`。
- `requestSceneRender()` 在 runtime 动画场景里优先要求传 bounds；没有 patch、没有 bounds 时直接跳过，不再为了“兜底”发送空的 render 请求。
- 这轮不改 `start(0)` 的主调度模型，也不引入 `maxFPS`。如果 link/node attr churn 收敛后 profile 仍显示调度壳是头部热点，再另起任务处理。

### 6. 把同源收益覆盖到创建/清理和检测链路

- 由于 `LinkViewHost` 不再为每条 link 创建 5 个 dot `Rect`，link view 的创建与销毁成本会同步下降；这属于本轮同源收益，纳入验收。
- `editor/js/litegraph-benchmark.js` 的 runtime 采样补充掉帧类指标：
  - `frame_gap_avg_ms`
  - `frame_gap_p95_ms`
  - `frame_gap_max_ms`
  - `dropped_frame_equivalent`
- benchmark 继续保留 `fps_avg/fps_min`，但掉帧回归以后者作为主判定，不再只看 `step_avg_ms`。
- 文档同步更新到 `guides/Leafer迁移`，明确写死：
  - modern runtime 连线动画现在是“短时高亮 path”，不是 legacy 的 1000ms 流动 dots
  - 这是性能优先的有意设计，不是临时退化

## Important API / Internal Contract Changes

- 不新增 public LiteGraph API。
- 内部 runtime contract 新增或收紧：
  - 图对象新增 dirty link 收集/消费能力，与现有 dirty node 链路并行
  - `requestRuntimeRender(...)` / `requestRuntimeAnimation(...)` 内部扩展为可携带 dirty `linkIds`
  - `LeaferActiveLinkPresentationResult` 去掉 `dots`
  - `LinkViewPresentation.flow` 在 modern 路径下固定只消费 `active + opacity`，不再依赖 dots
- 视觉兼容约束变更：
  - modern Leafer runtime 不再承诺复刻 legacy 的 1000ms 连线流动点动画
  - legacy canvas 渲染路径保持不变，不在本轮修改

## Test Plan

- 单元/静态验证

  - `triggerSlot()` 触发输出时会把 linkId 记录到图级 dirty-link 集合。
  - `clearTriggeredSlots()` 会让当前 active link 立即进入“关闭高亮”的 dirty 链路。
  - `SceneSyncController` runtime 动画路径不再包含全图 `collectActiveLinks()` 和全图 transient node 扫描。
  - `LeaferTaskWorker` active-link 结果不再含 `dots`，旧 `sample-link-flow-dots` 路径被移除。
  - `LinkViewHost` 构造后不再创建 flow dot `Rect` 子节点。
- 集成回归

  - `editor/index-ts-vite.html` 的 `event-runtime` 300 节点场景仍能看到连线触发反馈和节点执行灯。
  - 连线高亮在约 `180ms` 内自动消退；`clearTriggeredSlots()` 后立即消失。
  - runtime 动画停止条件正确：没有 active node/link 后，不再继续空转 frame。
  - graph clear / demo 切换 / benchmark restore 后，不残留 active link 视图或 worker 缓存。
  - link view 创建/销毁数量下降后，功能上不影响连线命中、颜色、箭头和锚点。
- 性能验收

  - 浏览器 DevTools 5 秒 trace 下，`refreshActiveLinkAnimations()` 不再是 40ms+ 级别热点，目标平均 `< 10ms`、峰值 `< 20ms`。
  - 2 秒 `event-runtime` 300 节点复现实验里，`dropped_frame_equivalent` 相比当前基线下降至少 `80%`。
  - `app.requestRender()` 在 500ms runtime 采样窗口内的调用量，相比当前基线下降至少 `60%`。
  - `LinkViewHost` child 数减少后，`node-create / node-delete / clear` 不允许回归；理想情况下 link-heavy create/clear 有可见下降。
  - benchmark 新增的 `frame_gap_* / dropped_frame_equivalent` 指标进入结果输出，后续可用于回归守卫。

## Assumptions

- 默认采用“性能优先”取舍，接受 modern runtime 的连线动画从流动 dots 降级为短时 path 高亮。
- 默认只处理与掉帧同源的 runtime 动画与 link-view 开销，不把 `ModernNodeHost` 布局、文本测量、批量 hydrate 这些其他性能议题混进本轮。
- 默认不使用 `maxFPS`、全局降帧或全图 `forceRender()` 作为主修复手段。
- 默认 legacy canvas 行为保持原样；本轮只改 modern Leafer runtime。
