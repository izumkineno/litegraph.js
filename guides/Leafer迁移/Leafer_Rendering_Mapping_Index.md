# Leafer Rendering Mapping Index

本文档是把当前节点图引擎从“立即模式 Canvas 手动刷新”迁移到 “LeaferJS 保留模式运行时”的重构索引。

目标不是在 Leafer 上再套一层旧的 `dirty_canvas + requestAnimationFrame + draw()` 机制，而是：

- 用 Leafer 的 UI 树作为唯一渲染真相
- 用 Leafer 的自动调度替换手动重绘循环
- 用 `App / Leafer / Group` 分层替换前后景双 Canvas
- 用官方插件优先接管视口与交互状态

---

## 0. Discovery 结论

### 0.1 已读取的 Leafer 核心文档

已完成对以下核心文档的阅读与归纳：

- `leafer-docs/reference/display/App.md`
- `leafer-docs/reference/display/Leafer.md`
- `leafer-docs/reference/display/Group.md`
- `leafer-docs/guide/advanced/app.md`
- `leafer-docs/guide/advanced/viewport.md`
- `leafer-docs/guide/advanced/partRender.md`
- `leafer-docs/guide/life/leafer.md`
- `leafer-docs/guide/life/render.md`
- `leafer-docs/guide/design/tree.md`
- `leafer-docs/reference/config/app/canvas.md`
- `leafer-docs/reference/config/app/type.md`
- `leafer-docs/reference/event/basic/Leafer.md`
- `leafer-docs/reference/event/basic/Render.md`
- `leafer-docs/reference/UI/forceUpdate.md`
- `leafer-docs/reference/UI/forceRender.md`
- `leafer-docs/plugin/in/viewport/index.md`
- `leafer-docs/plugin/in/state/index.md`
- `leafer-docs/reference/UI/state/hover.md`
- `leafer-docs/reference/UI/state/press.md`
- `leafer-docs/reference/UI/state/selected.md`

### 0.2 Leafer 运行时的关键事实

1. `App` 是官方推荐的多引擎分层容器，天然支持 `ground / tree / sky` 结构。
2. `App` 适合把不同更新频率的内容拆到不同 Leafer 层，减少不必要的重绘。
3. `Leafer` 自身负责生命周期、布局、局部渲染、自动渲染调度，不需要外部常驻 `requestAnimationFrame` 循环来驱动画布。
4. Leafer 首次布局、首次渲染、后续增量渲染都有清晰生命周期，可通过 `ready / viewReady / RenderEvent.*` 监听。
5. `Group` 是最适合承载图层树、节点集合、连线集合、覆盖层集合的容器。
6. `zoomLayer` 是官方视口缩放平移入口，应该替代我们现在的 `DragAndScale + ds.offset + ds.scale`。
7. `forceUpdate()` / `forceRender()` 是兜底 API，不应成为新的主刷新路径。
8. 官方文档明确指出：背景网格这类“包围盒不稳定”内容，可单独做一层，并视情况关闭局部渲染。
9. `@leafer-in/viewport` 是视口插件，适合替代旧引擎的滚轮、触摸板、捏合、平移逻辑。
10. `@leafer-in/state` 是 hover / press / focus / selected / disabled 状态样式插件，适合替代一部分人工状态样式逻辑。

### 0.3 当前仓库里的 Leafer 依赖状态

- 已存在：`leafer-ui@2.0.2`
- 已存在：`@leafer-in/viewport@2.0.2`
- 已存在：`@leafer-in/state@2.0.2`

结论：

- 第一批视口迁移可以直接优先使用 `@leafer-in/viewport`
- 交互状态样式已经具备走官方 `@leafer-in/state` 的条件

---

## 1. 渲染根节点映射（Root Container）

### 1.1 旧版 DOM 获取与挂载逻辑

当前主挂载点在：

- `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts`
  - `constructor(canvas, graph, options)`
  - `setCanvas(canvas, skip_events?)`

它当前做了这些事：

1. 接收 `HTMLCanvasElement | string | null`
2. 通过 `document.querySelector()` / `document.getElementById()` 解析 DOM
3. 保存 `this.canvas`
4. 额外创建 `this.bgcanvas`
5. 获取 `2d` 上下文 `ctx / bgctx`
6. 绑定鼠标/键盘/滚轮事件
7. 调用 `startRendering()` 启动常驻渲染循环

外围创建入口在：

- `editor/js/litegraph-editor.js`
  - `Editor(...)`
  - 直接拼出 `<canvas class='graphcanvas'>`
  - 然后执行 `new LGraphCanvas(canvas, graph)`

旧 runtime 的历史对照点在：

- `src/litegraph.js`
  - `function LGraphCanvas(canvas, graph, options)`

### 1.2 新根节点的推荐接管方式

推荐使用 `App` 作为新的根运行时，而不是单个 `Leafer`。

原因：

- 我们当前引擎已经天然分成背景、主内容、交互覆盖三类内容
- `App` 的 `ground / tree / sky` 与现有需求完全同构
- 后续节点、连线、覆盖层分层不会再被“双 Canvas”结构限制

### 1.3 应在哪个生命周期创建 Leafer Root

推荐接管时机：

- 在 `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts::setCanvas()` 中
- 在“目标 DOM 已解析完成”之后
- 在“旧的 `bindEvents()` / `startRendering()` 执行之前”

理由：

- 这一刻已经拿到了真实挂载 DOM
- graph 已经可附着
- 这是当前旧渲染系统最稳定的边界层

### 1.4 根容器的 DOM 形态建议

长期建议：

- `editor/js/litegraph-editor.js` 不再创建单个 `<canvas class='graphcanvas'>`
- 改为创建一个专用容器，例如 `<div class='graphview'></div>`
- 让 `App({ view })` 直接接管这个容器

过渡期建议：

- 允许 `LGraphCanvas` 继续接受旧的 canvas 参数
- 但内部应尽快把“单 canvas 视图”提升为“容器视图”
- 否则 `App` 多层渲染的优势无法完全释放

---

## 2. 渲染循环替代方案（Render Loop Replacement）

### 2.1 旧版手动刷新主链路

当前链路是：

1. 图或节点变更
2. `LGraph.change()` / `LGraph.setDirtyCanvas()` / `LGraphNode.setDirtyCanvas()`
3. `sendActionToCanvas("setDirty", [fg, bg])`
4. `LGraphCanvas.setDirty(fg, bg)`
5. 常驻 `requestAnimationFrame` 循环调用 `draw()`
6. `draw()` 决定执行 `drawBackCanvas()` / `drawFrontCanvas()`
7. `ctx.clearRect()` 后重绘

### 2.2 旧方法到 Leafer 行为的映射

| 旧入口 | 当前位置 | 旧职责 | Leafer 替代行为 |
| --- | --- | --- | --- |
| `startRendering()` | `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts` | 启动常驻 rAF 绘制循环 | 删除常驻绘制循环，改为创建并 `start()` Leafer `App`；渲染由 Leafer 自动调度 |
| `stopRendering()` | `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts` | 停止绘制循环 | 改为 `app.stop()` / `leafer.stop()` |
| `setDirty(fg, bg)` | `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts` | 设置前景/背景脏标记 | 不再维护脏标记；改为更新 UI 树节点属性、子节点结构或状态 |
| `draw()` | `src/ts-migration/canvas/LGraphCanvas.render.ts` | 本帧协调前后景绘制 | 替换为“场景同步器”或“视图适配器”，只负责把 graph state 同步到 Leafer UI 树 |
| `drawFrontCanvas()` | `src/ts-migration/canvas/LGraphCanvas.render.ts` | 手绘节点、选择框、连接预览、HUD | 拆成 Leafer `tree` / `sky` 层中的多个 `Group` |
| `drawBackCanvas()` | `src/ts-migration/canvas/LGraphCanvas.render.ts` | 手绘背景、网格、groups、连线 | 拆到 `ground` 与 `tree` 下的独立层树 |
| `LGraph.change()` | `src/ts-migration/models/LGraph.io-events.ts` | 广播全局视觉变化 | 改为触发 scene adapter 同步，不再发 `setDirty` |
| `LGraph.setDirtyCanvas()` | `src/ts-migration/models/LGraph.io-events.ts` | 转发图级重绘请求 | 改为“更新受影响的 Leafer 节点/层” |
| `LGraphNode.setDirtyCanvas()` | `src/ts-migration/models/LGraphNode.canvas-collab.ts` | 转发节点级重绘请求 | 改为更新节点对应的 UI / Group / 连线视图对象 |
| `dirty_canvas = true` / `dirty_bgcanvas = true` | `input.ts` / `render.ts` / `static.ts` / `menu-panel.ts` | 标记需要下一帧重绘 | 改为更新状态节点、选择节点、连接预览节点、视口变换 |
| `graph.onAfterExecute = graphcanvas.draw(true)` | `editor/js/litegraph-editor.js` | 图执行后强制绘制 | 删除；执行阶段只更新数据或视图模型，让 Leafer 自动重绘 |
| `graphcanvas.draw(true, true)` | `editor/js/litegraph-editor.js` / `editor/js/litegraph-benchmark.js` | 立即整画布强刷 | 删除；必要时只在极端兜底场景调用 `leafer.forceRender()` |

### 2.3 在 Leafer 体系下，真正应该发生什么

正确的新路径应该是：

1. graph / node / link / selection / viewport 发生变化
2. 对应的 Leafer `UI / Group / Leafer` 属性或 children 发生变化
3. Leafer 内部自动收集变化
4. Leafer 自动进行局部布局 / 局部渲染

### 2.4 允许保留的极少数“强制刷新”场景

仅建议在以下场景使用 Leafer 的强制刷新 API：

- 改了非标准自定义属性，需要补一次 `forceUpdate(attrName?)`
- 改了只影响绘制、不影响布局的底层资源，需要补一次 `forceRender()`
- 改了画布 `smooth` / 特殊 context 配置，需要补一次整层 render

结论：

- `forceUpdate` / `forceRender` 是逃生口
- 不应该把旧的 `setDirtyCanvas()` 直接机械替换成 `forceRender()`

### 2.5 视口交互的替换原则

当前旧视口栈主要是：

- `src/ts-migration/canvas/DragAndScale.ts`
- `src/ts-migration/canvas/LGraphCanvas.input.ts::processMouseWheel`
- `src/ts-migration/canvas/LGraphCanvas.input.ts::setZoom`
- `ds.offset / ds.scale`

新方案应优先改为：

- 用 `@leafer-in/viewport`
- 让 `App.tree.zoomLayer` 或目标 `Leafer.zoomLayer` 成为唯一视口变换源
- 所有平移 / 缩放都落到 `zoomLayer.x / y / scaleX / scaleY`

这意味着：

- `DragAndScale` 最终应被移除或降级为兼容适配层
- 不应再继续维护一套平行的 `ds` 变换系统

---

## 3. 图层结构树规划（Layering Strategy）

### 3.1 推荐总结构

推荐使用：

```text
App(view = graphHost)
├─ ground: Leafer
│  └─ gridWorld: Group
├─ tree: Leafer
│  └─ world: Group  (= tree.zoomLayer)
│     ├─ groupLayer: Group
│     ├─ linkLayer: Group
│     └─ nodeLayer: Group
└─ sky: Leafer
   ├─ overlayWorld: Group
   └─ overlayScreen: Group
```

### 3.2 每层职责

#### `ground`

职责：

- 无限网格
- 背景贴图
- 只与背景有关的低频元素

建议：

- `hittable = false`
- 如果网格边界难以稳定计算，可考虑关闭该层的局部渲染

#### `tree`

职责：

- graph 世界坐标系下的主内容
- group 区块
- 连线
- 节点本体

建议：

- `tree.zoomLayer` 作为世界视口根
- `groupLayer < linkLayer < nodeLayer`
- 节点与连线都处于同一世界变换之下

#### `sky`

职责：

- 临时交互视觉
- 连接拖拽预览
- 选择框
- hover 高亮
- tooltip
- 屏幕坐标 HUD / 面板锚点

建议：

- `overlayWorld`
  - 用于需要跟随 world 变换的临时元素
  - 例如：连接预览、端口 hover halo、世界坐标选择框
- `overlayScreen`
  - 用于屏幕坐标元素
  - 例如：HUD、提示层、固定面板锚点

当前实现说明：

- `overlayWorld` 已用于世界空间交互图元，例如连线预览、框选框等。
- `overlayScreen` 目前仍是预留层，不承载右键菜单、搜索框、dialog。
- 右键菜单和其他屏幕浮层当前仍走 DOM `floating-ui-service`，这是现状，不是最终目标态。

### 3.3 Z-Index 管理原则

跨 Leafer 引擎：

- `ground < tree < sky`

Leafer 内部：

- 用 child 顺序或 `zIndex` 管理
- 不再靠“先画后画”的函数顺序推导层级

### 3.4 与旧 `drawBackCanvas / drawFrontCanvas` 的对应关系

| 旧阶段 | 旧内容 | 新归属 |
| --- | --- | --- |
| `drawBackCanvas()` | 背景色、背景图、网格 | `ground.gridWorld` |
| `drawBackCanvas()` | groups | `tree.world.groupLayer` |
| `drawBackCanvas()` | links | `tree.world.linkLayer` |
| `drawFrontCanvas()` | nodes | `tree.world.nodeLayer` |
| `drawFrontCanvas()` | connection preview | `sky.overlayWorld` |
| `drawFrontCanvas()` | dragging rectangle / selection visuals | `sky.overlayWorld` |
| `drawFrontCanvas()` | tooltip / HUD / overlay（目标态） | `sky.overlayScreen` |

### 3.5 交互状态插件策略

优先推荐：

- 端口 hover
- 节点 hover
- 按下态
- 选中态
- disabled / focus 样式

走 `@leafer-in/state`，而不是继续在 Canvas 绘制代码里手写状态分支。

当前仓库状态：

- `@leafer-in/state` 已安装并已在 Leafer 宿主初始化时加载

因此当前阶段的合理策略是：

- 结构层迁移
- 视口迁移
- legacy 节点继续保留兼容桥
- modern 节点逐步切换到 state plugin 驱动的 hover / press / selected 样式

---

## 4. 重构靶点清单（Target Checklist）

### 4.1 根容器与生命周期

- [ ] `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts::constructor`
- [ ] `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts::setCanvas`
- [ ] `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts::bindEvents`
- [ ] `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts::unbindEvents`
- [ ] `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts::setDirty`
- [ ] `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts::startRendering`
- [ ] `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts::stopRendering`
- [ ] `editor/js/litegraph-editor.js::Editor`

### 4.2 旧渲染循环与绘制函数

- [ ] `src/ts-migration/canvas/LGraphCanvas.render.ts::draw`
- [ ] `src/ts-migration/canvas/LGraphCanvas.render.ts::drawFrontCanvas`
- [ ] `src/ts-migration/canvas/LGraphCanvas.render.ts::drawBackCanvas`
- [ ] `src/ts-migration/canvas/LGraphCanvas.render.ts::drawNode`
- [ ] `src/ts-migration/canvas/LGraphCanvas.render.ts::drawConnections`
- [ ] `src/ts-migration/canvas/LGraphCanvas.render.ts::renderLink`
- [ ] `src/ts-migration/canvas/LGraphCanvas.render.ts::drawGroups`
- [ ] `src/ts-migration/canvas/LGraphCanvas.render.ts::drawNodeWidgets`
- [ ] `src/ts-migration/canvas/LGraphCanvas.render.ts::drawLinkTooltip`
- [ ] `src/ts-migration/canvas/LGraphCanvas.render.ts::drawSubgraphPanel`

### 4.3 旧视口与坐标系统

- [ ] `src/ts-migration/canvas/DragAndScale.ts::constructor`
- [ ] `src/ts-migration/canvas/DragAndScale.ts::bindEvents`
- [ ] `src/ts-migration/canvas/DragAndScale.ts::onMouse`
- [ ] `src/ts-migration/canvas/DragAndScale.ts::mouseDrag`
- [ ] `src/ts-migration/canvas/DragAndScale.ts::changeScale`
- [ ] `src/ts-migration/canvas/DragAndScale.ts::convertOffsetToCanvas`
- [ ] `src/ts-migration/canvas/DragAndScale.ts::convertCanvasToOffset`
- [ ] `src/ts-migration/canvas/LGraphCanvas.input.ts::processMouseWheel`
- [ ] `src/ts-migration/canvas/LGraphCanvas.input.ts::setZoom`
- [ ] `src/ts-migration/canvas/LGraphCanvas.input.ts::adjustMouseEvent`
- [ ] `src/ts-migration/canvas/LGraphCanvas.input.ts::centerOnNode`

### 4.4 脏标记广播链

- [ ] `src/ts-migration/models/LGraph.io-events.ts::sendActionToCanvas`
- [ ] `src/ts-migration/models/LGraph.io-events.ts::change`
- [ ] `src/ts-migration/models/LGraph.io-events.ts::setDirtyCanvas`
- [ ] `src/ts-migration/models/LGraphNode.canvas-collab.ts::setDirtyCanvas`
- [ ] `src/ts-migration/models/LGraphNode.canvas-collab.ts::loadImage`
- [ ] `src/ts-migration/models/LGraph.structure.ts` 中所有 `setDirtyCanvas(...)` 调用点
- [ ] `src/ts-migration/models/LGraphNode.ports-widgets.ts` 中所有 `setDirtyCanvas(...)` 调用点
- [ ] `src/ts-migration/models/LGraphNode.connect-geometry.ts` 中所有 `setDirtyCanvas(...)` 调用点
- [ ] `src/ts-migration/models/graph-deserializer.ts::deserializeGraphData` 结束后的强制重绘调用

### 4.5 输入与交互驱动的手动重绘

- [ ] `src/ts-migration/canvas/LGraphCanvas.input.ts::processMouseDown`
- [ ] `src/ts-migration/canvas/LGraphCanvas.input.ts::processMouseMove`
- [ ] `src/ts-migration/canvas/LGraphCanvas.input.ts::processMouseUp`
- [ ] `src/ts-migration/canvas/LGraphCanvas.input.ts::selectNodes`
- [ ] `src/ts-migration/canvas/LGraphCanvas.input.ts::deselectAllNodes`
- [ ] `src/ts-migration/canvas/LGraphCanvas.input.ts::deleteSelectedNodes`
- [ ] `src/ts-migration/canvas/LGraphCanvas.input.ts` 中所有直接写 `dirty_canvas / dirty_bgcanvas` 的分支

### 4.6 菜单、面板与外围强刷调用点

- [ ] `src/ts-migration/canvas/LGraphCanvas.static.ts` 中所有直接写 `dirty_canvas / dirty_bgcanvas` 或 `node.setDirtyCanvas(...)` 的菜单动作
- [ ] `src/ts-migration/canvas/LGraphCanvas.menu-panel.ts` 中直接写 `dirty_canvas` 的分支
- [ ] `src/ts-migration/services/context-menu-controller.ts` 中 `graphcanvas.setDirty(...)` 调用点
- [ ] `src/ts-migration/services/prompt-dialog-controller.ts` 中 `graphcanvas.setDirty(...)` 调用点
- [ ] `src/ts-migration/services/property-value-dialog-controller.ts` 中 `node.setDirtyCanvas(...)` 调用点
- [ ] `editor/js/litegraph-editor.js::graph.onAfterExecute = graphcanvas.draw(true)`
- [ ] `editor/js/litegraph-editor.js::onPlayStepButton`
- [ ] `editor/js/litegraph-editor.js::onLiveButton`
- [ ] `editor/js/litegraph-benchmark.js` 中所有 `setDirty()/draw(true, true)` 调用点

### 4.7 执行循环与渲染解耦

- [ ] `src/ts-migration/models/LGraph.lifecycle.ts::start`

说明：

- 这里的 `requestAnimationFrame` 主要是图执行循环，不是画布渲染循环
- 它可以继续存在于“实时执行模式”
- 但必须删除“执行一步就强制画一帧”的耦合

### 4.8 legacy 对照参考（若需要保持 dist 同步）

- [ ] `src/litegraph.js::LGraphCanvas`
- [ ] `src/litegraph.js::LGraphCanvas.prototype.setDirty`
- [ ] `src/litegraph.js::LGraphCanvas.prototype.draw`
- [ ] `src/litegraph.js::LGraphCanvas.prototype.drawFrontCanvas`
- [ ] `src/litegraph.js::LGraphCanvas.prototype.drawBackCanvas`

---

## 5. 建议的第一刀实施顺序

1. 先替换根容器：
   - 在 `LGraphCanvas.lifecycle.ts` 中引入 `App`
   - 让 `setCanvas()` 负责创建并持有 `App`
2. 再替换视口：
   - 接入 `@leafer-in/viewport`
   - 让 `zoomLayer` 接管原 `DragAndScale`
3. 再拆图层：
   - `ground / tree / sky`
   - 先把网格、主内容、交互预览分离
4. 再拔掉手动循环：
   - 停用 `startRendering()` / `draw()` 链路
   - 把 `setDirtyCanvas()` 变成 scene sync 入口
5. 最后再清外围调用点：
   - editor
   - benchmark
   - menu / panel / property editor

---

## 6. 迁移原则

### 应该做的

- 改“数据 -> UI 树”同步方式
- 让 Leafer 负责渲染调度
- 用官方 viewport/state 插件优先替代自研输入状态逻辑
- 把背景、主内容、交互覆盖层真正拆成多层

### 不应该做的

- 不要把旧 `draw*()` 逻辑整体搬进 Leafer 的自定义绘制回调
- 不要把旧 `setDirtyCanvas()` 简单翻译成 `forceRender()`
- 不要同时长期维护 `ds.offset/scale` 与 `zoomLayer` 两套视口状态
- 不要继续让 editor / benchmark 直接强制 `draw(true, true)`

---

## 7. 当前结论

从代码结构和 Leafer 官方文档来看，这次迁移最合适的切入点非常明确：

- 根容器切到 `App`
- 视口切到 `zoomLayer + @leafer-in/viewport`
- 交互状态优先规划给 `@leafer-in/state`
- 旧的 `setDirty -> draw` 链变成 `graph state -> Leafer UI tree sync`

这份索引完成后，下一阶段就可以开始真正的 runtime 替换了。
