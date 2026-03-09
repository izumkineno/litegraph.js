# Modern Benchmark 性能复测与多线程索引方案

**Summary**

* 2026-03-09 用浏览器 DevTools 后端 CPU profiler 实测了 benchmark。
* **ts-migration / balanced** 当前结果约为：**create_total_ms 131-135**、**data_step_avg_ms 1.7-1.8**、**event_step_avg_ms 58-65**。
* **legacy / balanced** 基线约为：**create_total_ms 6.6**、**data_step_avg_ms 0.09**、**event_step_avg_ms 5.6**。
* modern 主线程采样热点首先是 Leafer 内部 bounds/update 链，第二层才是仓库代码。repo 侧主要热点集中在 **ModernNodeHost**、**LinkViewHost**、**SceneSyncController**。
* 结论固定为：下一步按“纯计算 Worker 化 + 先打 event-runtime”推进，不尝试把 Leafer UI 树或渲染所有权移到 Worker。

**Important Changes / Worker Index**

* 不改公开 LiteGraph API。只扩展内部 worker/runtime 协议。
* 扩展 **LeaferTaskWorker** 为批处理任务总线，新增一组“active link presentation batch”消息。
* 这组消息的输入固定为主线程快照出的纯数据：**linkId**、**start/end**、**startDir/endDir**、**lastTime**、**now**、**dotCount**。
* 这组消息的输出固定为主线程可直接消费的纯结果：**curve control points/path**、**midpoint**、**flow dots**、**opacity**、**active flag**。
* **SceneSyncController** 改为只在主线程做三件事：收集 active link 快照、提交批任务、消费结果并调用 **LinkViewHost.update()**。
* **NodePortAdapter** 仍留在主线程负责拿到 link layout 真相；Worker 只负责在拿到 **start/end/dir** 后做 **buildLinkCurve**、**getPointOnLinkCurve** 这类纯计算。
* **buildLinkArrowPresentation()** 保持主线程；它是轻量判断，不值得下放。
* 现有 **sample-link-flow-dots** 单一任务升级为更宽的 link batch 任务；旧接口作为兼容壳保留一个迁移周期，然后统一走新批处理入口。
* 多线程优先级索引固定如下：
* **A** 级：**SceneSyncController** 的 active link curve/dot/midpoint/opacity 批计算，直接命中 event-runtime 热点，纯计算，可安全下放。
* **A** 级：**NodePortAdapter.buildLinkCurve()** 与 **getPointOnLinkCurve()** 的批量版本，适合作为 worker 内核函数。
* **B** 级：link dirty-set 的批量筛选与结果合并，如果后续证明主线程遍历 active links 本身变热，再一起并入 worker batch。
* **C** 级：**ModernNodeHost** 的 port/layout 预计算只作为后续 hybrid 方案候选，本轮不做。
* **X** 级：**triggerSlot** / 图执行链不下放，原因是它依赖图状态和节点副作用，不能脱离主线程语义。
* **X** 级：Leafer **__updateLocalBounds** / **updateBounds** / attr patch 链不下放，原因是当前方案不改变 UI 树主线程所有权。
* **X** 级：**LeaferTextMetrics** 的真正测量不下放，原因是它依赖 Leafer measurement root；这里只保留主线程缓存优化。

**Implementation Changes**

* 第一阶段只覆盖 **event-runtime** 相关 link 动画与 presentation。
* **SceneSyncController** 里的 **prepareActiveLinkFlowSampling()** 和 **buildLinkFlowPresentation()** 合并为“主线程快照 + worker 结果消费”两段式。
* **resolveLinkCurve()** 改为优先查 worker 结果缓存；只有 worker 不可用或结果缺失时才走主线程 fallback。
* **LinkViewHost** 保持主线程 patch，但输入改成尽量稳定的批量结果，避免每帧在主线程重复做 curve/dot 计算。
* worker 结果缓存键固定为 **linkId + start/end/startDir/endDir + lastTime bucket**，避免重复 clone 和重复计算。
* 主线程 fallback 必须保留，且在 **Worker** 不可用时行为完全不变。
* 这一轮不触碰 **ModernNodeHost** 的 shell/UI 结构，只要求它不因为 link batch 化而新增 repaint。

**Test Plan**

* 用浏览器 DevTools/CDP profiler 重新跑 **editor/index-ts-vite.html** 的 **balanced** preset。
* 验收指标固定为：modern **event_step_avg_ms** 相对当前基线下降至少 20%，目标先压到 **<=45ms**。
* **data_step_avg_ms** 不允许回归超过 10%。
* **create_total_ms** 不作为本轮主指标，但不允许明显恶化。
* 交互回归必须覆盖：缩放、平移、激活 link 动画、节点拖动、连线更新、active link 消失时的视图回收。
* 结果正确性必须覆盖：link path、midpoint、flow dots、opacity、arrow 开关与当前主线程实现一致。
* Worker 关闭或不支持时，benchmark 结果和交互语义必须回退到当前主线程路径。

**Assumptions**

* 默认采用“纯计算 Worker 化”，不探索 OffscreenCanvas/渲染线程。
* 默认把 event-runtime 当作唯一优先目标；create/layout 优化留到下一轮。
* 默认接受一个现实约束：Leafer bounds/update 仍是主线程第一大成本，所以这一轮目标是显著降 event-runtime，而不是直接追平 legacy。
* 默认保留现有 **LeaferTaskWorker**，在其上扩展批处理协议，而不是引入第二套 worker 基础设施。
