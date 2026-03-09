# Leafer 性能优化指南

## 目的
- 这份文档用于给当前 `ts-migration/leafer` 路径建立一套稳定的性能优化基线。
- 目标不是泛泛整理 Leafer API，而是把本仓库已经暴露出来的热点、Leafer 官方能力、以及下一步的落地策略收拢到同一处。
- 本文依据两类材料整理：
  - 本地 `leafer-docs`
  - 2026-03-09 通过 Context7 查询的官方 Leafer 文档 `/leaferjs/docs`

## 当前仓库基线
- 参考 [Modern_Benchmark_2026-03-09.md](./Modern_Benchmark_2026-03-09.md)：
  - modern `balanced`
  - `create_total_ms ~= 181.6`
  - `data_step_avg_ms ~= 0.33`
  - `event_step_avg_ms ~= 20.19`
- 当前 repo 侧仍然明显可见的热点主要集中在：
  - [ModernNodeHost.ts](../../src/ts-migration/leafer/ModernNodeHost.ts)
  - [SceneSyncController.ts](../../src/ts-migration/leafer/SceneSyncController.ts)
  - [LinkViewHost.ts](../../src/ts-migration/leafer/LinkViewHost.ts)
  - [LeaferTextMetrics.ts](../../src/ts-migration/leafer/LeaferTextMetrics.ts)
- 已确认的核心现实约束：
  - Leafer UI 树和真实渲染仍在主线程
  - Worker 只适合做纯计算，不适合接管 UI 树所有权
  - modern runtime 的主要损失已经从“纯 JS 逻辑”转向“Leafer bounds/update/attr churn”

## 优化总原则

### 1. 先减少更新，再减少绘制
- Leafer 已经提供局部渲染与局部布局能力，优先级高于自建全局刷新策略。
- 对本仓库来说，最有价值的事情不是“每帧做得更快”，而是“避免本不该发生的 attr 写入、bounds 更新、layout 传播”。

### 2. 优先使用 Leafer 自己的调度面
- 有渲染时机需求时，优先考虑 Leafer 自带的调度与生命周期能力，而不是继续堆更多自定义 `requestAnimationFrame`。
- 这条原则尤其适用于：
  - 渲染后读取几何
  - 局部视图更新后的回调
  - 小范围状态动画

### 3. 纯 Leafer 路径禁止回退到 DOM canvas
- `src/ts-migration/leafer/**`
- `src/nodes_leafer/**`
- 这两条路径里不应再出现 `document.createElement("canvas")` 或新的 2D 离屏绘制链。
- 纯 Leafer 路径允许瞬时 DOM editor，但不允许为了文本测量、连线预览、局部缓存而重新引入 canvas。

### 4. Worker 只接纯数据
- 适合下放到 Worker 的必须是：
  - 无 DOM
  - 无 Leafer UI 树引用
  - 无图执行副作用
  - 输入输出都可以序列化
- 不适合下放：
  - `triggerSlot`
  - graph 执行链
  - Leafer bounds / attr patch
  - 依赖测量根节点的真实文本测量

## Leafer 官方能力与仓库落点

## App 级配置
- 来源：
  - [leafer-docs/reference/config/app/base.md](../../leafer-docs/reference/config/app/base.md)
  - Context7 `/leaferjs/docs`

### `usePartRender`
- 官方含义：启用局部渲染。
- 当前仓库状态：
  - [LeaferAppHost.ts](../../src/ts-migration/leafer/LeaferAppHost.ts) 已开启。
- 对本仓库的建议：
  - 保持开启。
  - 所有 `SceneSyncController` 的脏区提交都应尽量提供 bounds，避免退化成全画布 `forceRender()`。

### `usePartLayout`
- 官方含义：启用局部布局。
- 当前仓库状态：
  - [LeaferAppHost.ts](../../src/ts-migration/leafer/LeaferAppHost.ts) 已开启。
- 对本仓库的建议：
  - 保持开启。
  - 不要在 `Data` 级 patch 中混入尺寸、端口 gutter、最小宽度等布局级更新。

### `maxFPS`
- 官方含义：限制最高渲染帧率，可用于节省性能开销。
- 当前仓库状态：
  - 未显式设置。
- 对本仓库的建议：
  - 编辑器主交互阶段默认先保持不降帧。
  - 若后续要给“仅 runtime 动画”做节流，可优先评估：
    - 动画激活时保持默认
    - 空闲或非动画阶段降到 `30`
  - 这项配置适合做“整体功耗控制”，不适合拿来掩盖热路径设计问题。

### `useCellRender`
- 官方含义：用于优化大量重复内容覆盖渲染的场景。
- 当前仓库状态：
  - 未启用。
- 对本仓库的建议：
  - 暂不作为第一优先级。
  - 目前图编辑器更大的瓶颈是节点与连线的高频局部更新，不是重复贴片类场景。
  - 除非后续证明分层背景、缩略图、或大量重复 decoration 才是主成本，否则不建议现在引入。

## 局部渲染与调度
- 来源：
  - [leafer-docs/reference/display/Leafer.md](../../leafer-docs/reference/display/Leafer.md)
  - [leafer-docs/reference/event/basic/Render.md](../../leafer-docs/reference/event/basic/Render.md)
  - [leafer-docs/reference/UI/nextRender.md](../../leafer-docs/reference/UI/nextRender.md)
  - Context7 `/leaferjs/docs`

### `forceRender(bounds?, sync?)`
- 官方含义：支持指定 bounds 的局部重渲染；`sync` 可触发同步渲染。
- 当前仓库状态：
  - [SceneSyncController.ts](../../src/ts-migration/leafer/SceneSyncController.ts) 已使用 bounds 版和全量版 `forceRender()`。
- 对本仓库的建议：
  - 把它当成“提交脏区”的底层出口，而不是“哪里不对就全量刷一下”的兜底。
  - 默认优先传入 merged dirty bounds。
  - `sync: true` 只在非常明确需要立即几何一致性的场景下使用，不能成为常规路径。

### `render.request(...)`
- 官方含义：Leafer 提供的跨平台渲染/动画帧请求接口。
- 对本仓库的建议：
  - 适合取代零散的一次性异步渲染请求。
  - 如果后续还要继续瘦身 [SceneSyncController.ts](../../src/ts-migration/leafer/SceneSyncController.ts) 的自定义 frame 调度，可优先评估把“下一次需要刷新的轻量任务”并入 Leafer 调度面。
- 不建议：
  - 用它包装整套 graph runtime 事件循环。
  - 把本来应该按 dirty bounds 驱动的逻辑重新退化成“每帧都做一次”。

### `UI.nextRender(...)` / `removeNextRender(...)`
- 官方含义：等待下一次渲染帧执行函数。
- 对本仓库的建议：
  - 适合在以下场景使用：
    - patch 完后再读取 bounds
    - patch 完后再同步外部 DOM editor / overlay
    - patch 完后再做一次性测量与对齐
  - 不适合：
    - 高频动画循环
    - 每个节点 repaint 后都无条件挂一个 nextRender

### `RenderEvent.REQUEST/START/RENDER/END`
- 官方含义：Leafer 渲染生命周期事件。
- 对本仓库的建议：
  - 适合做：
    - profiling 埋点
    - 渲染阶段观测
    - render end 后的一次性收尾
  - 不适合：
    - 在这些事件中继续堆叠复杂业务逻辑
    - 用生命周期事件代替清晰的脏区收集机制

## 布局与 bounds
- 来源：
  - [leafer-docs/guide/advanced/bounds.md](../../leafer-docs/guide/advanced/bounds.md)
  - [leafer-docs/reference/UI/bounds.md](../../leafer-docs/reference/UI/bounds.md)
  - [leafer-docs/reference/display/Leafer.md](../../leafer-docs/reference/display/Leafer.md)
  - Context7 `/leaferjs/docs`

### `lockLayout()` / `unlockLayout()`
- 官方含义：批处理期间锁住布局，减少多次布局重算。
- 对本仓库的建议：
  - 适合用于：
    - 初始 hydrate / 批量创建 host
    - 批量更新一组 link 几何
    - 批量移动/缩放节点后再统一解锁
  - 尤其当一个操作会连续写多个与布局相关的 attr 时，应优先考虑包在一次 layout lock 内。

### Bounds 使用原则
- Leafer 文档明确区分：
  - `content`
  - `box`
  - `stroke`
  - `render`
  - world/local/inner 等坐标系
- 对本仓库的建议：
  - 命中与连线锚点尽量只维护一套“唯一真相”的 world 几何。
  - 不要在缩放和平移后同时混用：
    - graph 坐标
    - screen 坐标
    - Leafer local bounds
  - 读 bounds 必须知道自己要的是：
    - 逻辑锚点
    - 可见渲染边界
    - 命中边界
- 直接推论：
  - 之前 modern widget 在多次缩放/平移后错位，本质上就是“命中、视觉、事件坐标系不统一”的问题，这类问题后续都应该按 bounds 真相统一来解。

## 动画策略
- 来源：
  - [leafer-docs/reference/UI/animate.md](../../leafer-docs/reference/UI/animate.md)
  - Context7 `/leaferjs/docs`

### `animate()` / `killAnimate()`
- 官方含义：Leafer 原生动画能力。
- 对本仓库的建议：
  - 适合：
    - hover
    - selection outline
    - 小按钮高亮
    - signal lamp 的短时状态过渡
  - 不适合：
    - graph runtime 每步都要更新的大规模 link active 动画
    - 需要严格与执行步同步的数值驱动动画
- 原因：
  - 这类全图 runtime 动画的主要成本通常不在“插值”，而在“批量 attr 写入 + bounds 更新”。
  - 所以对 active link 动画，优先级仍然是减少计算与 patch 规模，而不是盲目引入更多动画对象。

## Worker 策略
- 来源：
  - [leafer-docs/guide/install/ui/worker/start.md](../../leafer-docs/guide/install/ui/worker/start.md)
  - Context7 `/leaferjs/docs`

### 官方边界
- 文档明确指出 Worker 环境不能操作 DOM。
- 这意味着 Worker 模式适合承担纯渲染引擎或纯计算场景，但对当前仓库这种“图编辑器 + 主线程事件系统 + DOM editor + Leafer 主线程 UI 树”的结构，不能简单把现有 runtime 全搬过去。

### 当前仓库建议
- 保留当前路线：
  - 主线程保留 Leafer UI 树所有权
  - Worker 只做纯计算批处理
- 当前已经适合 Worker 的方向：
  - active link presentation 批计算
  - 曲线控制点/采样点
  - opacity / midpoint / dots 等可序列化结果
- 当前不适合 Worker 的方向：
  - `ModernNodeHost` 直接 patch UI
  - 文本真实测量
  - graph 执行、slot 触发、副作用传播

## 面向当前仓库的具体建议

### 1. `LeaferAppHost` 继续做统一性能入口
- 参考 [LeaferAppHost.ts](../../src/ts-migration/leafer/LeaferAppHost.ts)
- 建议保持其职责集中在：
  - App config
  - layer registry
  - measurement root
  - task worker
- 不建议把更多业务调度塞回这里，否则会重新形成新的全局热路径。

### 2. `SceneSyncController` 优先继续压缩“无效 repaint”
- 参考 [SceneSyncController.ts](../../src/ts-migration/leafer/SceneSyncController.ts)
- 下一轮最值得做的事：
  - 继续缩小 dirty node 集合
  - 优先走 merged bounds 的局部 `forceRender`
  - 把“必须每帧执行”的逻辑和“只需下一帧执行一次”的逻辑拆开
  - 评估用 Leafer 自带调度面替代一部分自建帧调度

### 3. `ModernNodeHost` 继续减少 attr churn
- 参考 [ModernNodeHost.ts](../../src/ts-migration/leafer/ModernNodeHost.ts)
- 下一轮最值得做的事：
  - `Data` patch 继续与 `Layout/Ports` 严格隔离
  - 稳定 port 子树，不重建 UI
  - 相同 attr 不重复写入
  - 将标题、summary、meta、widget 值更新限制在局部文本和局部状态

### 4. `LeaferTextMetrics` 保持“主线程测量 + 强缓存”
- 参考 [LeaferTextMetrics.ts](../../src/ts-migration/leafer/LeaferTextMetrics.ts)
- 建议：
  - 继续以 measurement root 做真实测量
  - 保持字体 token + 文本内容作为缓存键
  - 严禁在纯 Leafer 路径回退到 DOM canvas 测量

### 5. `LinkViewHost` 与 runtime link 动画继续拆分
- 参考 [LinkViewHost.ts](../../src/ts-migration/leafer/LinkViewHost.ts)
- 建议：
  - worker 负责算
  - 主线程负责 patch
  - path 不变就不要重复 set
  - opacity / dots / active 状态尽量走稳定批量结果，不在主线程重复推导

## 反模式清单
- 在纯 Leafer 路径重新引入 `document.createElement("canvas")`
- 只要出现脏数据就全量 `forceRender()`
- `Data` 变更顺手触发布局重算
- 高频路径里反复销毁/重建 port、widget、action part 子树
- 在未统一坐标系前直接做 hit test 或 overlay 定位
- 用 Worker 承担图执行或 UI 树操作
- 在 `RenderEvent` 或 `nextRender()` 里堆大量业务逻辑
- 用 `maxFPS` 掩盖热路径 attr 抖动

## 建议执行顺序
1. 继续减少 `SceneSyncController` 的无效 repaint 和无效 link update。
2. 继续减少 `ModernNodeHost` / `LinkViewHost` 的重复 attr 写入。
3. 只在必须读取最终几何时使用 `nextRender()`。
4. 只在局部 UI 状态动画上使用 `animate()`，避免扩散到全图 runtime。
5. 保持 Worker 只处理纯计算批任务，不扩展到 graph 执行或 UI patch。
6. 等主线程 attr churn 再降一轮后，再评估 `maxFPS`、`useCellRender` 之类的全局开关收益。

## 后续检查清单
- 新增 Leafer 代码时，先问三个问题：
  - 这是 `Data`、`Style`、还是 `Layout` 级更新？
  - 这次更新是否真的需要写 attr？
  - 这次更新是否真的需要新一轮 bounds / layout？
- 新增 runtime 动画时，先问三个问题：
  - 这是局部 UI 动画还是全图 runtime 动画？
  - 能否变成一次性 patch，而不是每帧 patch？
  - 能否把纯计算下放到 Worker？
- 新增坐标换算时，先问两个问题：
  - 真相坐标系是 world 还是 local？
  - 命中、视觉、连线锚点是否共享同一套几何？

## 参考
- 本地 Leafer 文档：
  - [leafer-docs/reference/config/app/base.md](../../leafer-docs/reference/config/app/base.md)
  - [leafer-docs/reference/display/Leafer.md](../../leafer-docs/reference/display/Leafer.md)
  - [leafer-docs/reference/event/basic/Render.md](../../leafer-docs/reference/event/basic/Render.md)
  - [leafer-docs/reference/UI/nextRender.md](../../leafer-docs/reference/UI/nextRender.md)
  - [leafer-docs/reference/UI/animate.md](../../leafer-docs/reference/UI/animate.md)
  - [leafer-docs/guide/install/ui/worker/start.md](../../leafer-docs/guide/install/ui/worker/start.md)
  - [leafer-docs/guide/advanced/bounds.md](../../leafer-docs/guide/advanced/bounds.md)
  - [leafer-docs/reference/UI/bounds.md](../../leafer-docs/reference/UI/bounds.md)
- Context7：
  - Library: `/leaferjs/docs`
  - Query date: `2026-03-09`
  - Used for:
    - `forceRender(bounds, sync)`
    - `render.request(...)`
    - `UI.nextRender(...)`
    - `RenderEvent.*`
    - `animate()` / `killAnimate()`
    - app config / worker 边界补充
- 仓库实现参考：
  - [LeaferAppHost.ts](../../src/ts-migration/leafer/LeaferAppHost.ts)
  - [SceneSyncController.ts](../../src/ts-migration/leafer/SceneSyncController.ts)
  - [ModernNodeHost.ts](../../src/ts-migration/leafer/ModernNodeHost.ts)
  - [LinkViewHost.ts](../../src/ts-migration/leafer/LinkViewHost.ts)
  - [LeaferTextMetrics.ts](../../src/ts-migration/leafer/LeaferTextMetrics.ts)
