# Leafer Migration Blueprint

## Phase 1: Freeze Legacy Render Loop
- **Phase 目标**：把旧的 Canvas 刷新心脏从“主动驱动渲染”降级成“可被替换的遗留兼容层”。
- **涉及文件**：
  - `E:/Code/litegraph.js/src/ts-migration/canvas/LGraphCanvas.lifecycle.ts`
  - `E:/Code/litegraph.js/src/ts-migration/canvas/LGraphCanvas.render.ts`
  - `E:/Code/litegraph.js/src/ts-migration/models/LGraph.io-events.ts`
  - `E:/Code/litegraph.js/src/ts-migration/models/LGraphNode.canvas-collab.ts`
  - `E:/Code/litegraph.js/src/ts-migration/index.ts`
- **动作细节**：
  - 删除或短路 `startRendering()` 内对 `requestAnimationFrame` 的依赖，不再允许 `LGraphCanvas` 自己维持持续绘制循环。
  - 保留 `setDirty()`、`setDirtyCanvas()`、`sendActionToCanvas("setDirty")` 这些旧入口，但把它们改造成兼容事件，仅发出“某区域已失效”的运行时信号。
  - 在运行时引入显式开关，例如 `renderRuntime: "legacy-canvas" | "leafer"`，让调用端能选择新旧宿主。
  - 保留旧 `draw()` / `drawFrontCanvas()` / `drawBackCanvas()` 实现，作为后续 `LegacyNodeHost` 的离屏绘制来源，但不再把它们视作应用级渲染主循环。
- **验收标准（Acceptance Criteria）**：
  - 页面初始化后不再启动旧 `requestAnimationFrame` 画布循环。
  - 控制台或调试日志能明确显示“legacy render loop disabled”或等价状态。
  - 系统此时允许黑屏，但不得因移除 rAF 导致 graph 执行、节点注册或编辑器初始化崩溃。

## Phase 2: Inject Leafer App Shell
- **Phase 目标**：把 Leafer `App` 注入到现有宿主 DOM，并建立 `ground / tree / sky` 三层根场景。
- **涉及文件**：
  - `E:/Code/litegraph.js/src/ts-migration/canvas/LGraphCanvas.lifecycle.ts`
  - `E:/Code/litegraph.js/editor/js/litegraph-editor.js`
  - `E:/Code/litegraph.js/src/ts-migration/index.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/LeaferAppHost.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/LeaferLayerRegistry.ts`
- **动作细节**：
  - 在 `setCanvas()` 完成宿主 DOM 解析后创建 `LeaferAppHost`，由它接管原 `<canvas>` 所在容器。
  - 新建 `LeaferAppHost`，内部统一创建 `App`，并暴露 `ground`、`tree`、`sky`、`overlayWorld` 等固定分层引用。
  - 调用端 Host API 可以破坏性调整，旧的“直接拿到前后两个 canvas”模式允许废弃。
  - 保留最小兼容 façade，使 `LGraphCanvas` 仍能作为对外入口对象存在，但内部不再拥有原生双缓冲画布。
- **验收标准（Acceptance Criteria）**：
  - 页面能成功初始化 Leafer `App`，且 DOM 中可观察到新的 Leafer 宿主。
  - 画面允许仍为空白，但三层 root 容器必须已建立并可通过调试代码访问。
  - 旧前景/背景 canvas 即使还存在，也不再承担主显示职责。

## Phase 3: Establish Scene Sync Backbone
- **Phase 目标**：建立从 `LGraph` 领域模型到 Leafer 场景树的单向同步骨架，彻底禁止 render-time 全图扫描。
- **涉及文件**：
  - `E:/Code/litegraph.js/src/ts-migration/models/LGraph.structure.ts`
  - `E:/Code/litegraph.js/src/ts-migration/models/LGraph.io-events.ts`
  - `E:/Code/litegraph.js/src/ts-migration/models/LGraphNode.connect-geometry.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/GraphMutationBus.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/SceneSyncController.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/GraphLinksProxy.ts`
- **动作细节**：
  - 基于 `onNodeAdded` / `onNodeRemoved` 建立节点增删事件总线。
  - 为 `graph.links` 引入 Proxy 或等价包装，捕获 link 的 `set/delete`，统一发出 `link:add` / `link:remove`。
  - 新建 `SceneSyncController`，维护 `Map<NodeId, NodeHost>`、`Map<LinkId, LinkView>`、`linksByNodeId` 三套索引。
  - 明确规定：渲染函数不得遍历 `graph._nodes` 或 `graph.links` 来同步视图，所有结构变化必须从 mutation 事件驱动。
- **验收标准（Acceptance Criteria）**：
  - 手动执行 `graph.add(node)` / `graph.remove(node)` 时，对应 Leafer 节点容器会增删。
  - 手动创建或删除 link 时，对应 Leafer link 容器会增删。
  - 即便节点还没有真实绘制内容，场景树中也已经存在可调试的占位 group。

## Phase 4: Bring Up LegacyNodeHost Read-Only Mirror
- **Phase 目标**：让旧节点先以“只读位图镜像”方式在 Leafer 中稳定显示出来。
- **涉及文件**：
  - `E:/Code/litegraph.js/src/ts-migration/canvas/LGraphCanvas.render.ts`
  - `E:/Code/litegraph.js/src/ts-migration/models/LGraphNode.canvas-collab.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/LegacyNodeHost.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/NodeRuntimeDiscriminator.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/LegacyNodePainter.ts`
- **动作细节**：
  - 新建 `NodeRuntimeDiscriminator`，默认把现有节点识别为 `legacy`，后续再为现代节点开放 `buildUI()` 等接口探测。
  - 新建 `LegacyNodeHost`，在 Leafer `tree` 层中持有一个专用 `Group + Canvas/Image` 视图。
  - 从旧 `drawNode()` 管线中抽出可复用的离屏绘制入口，给 legacy 节点提供 `CanvasRenderingContext2D`，绘制完成后更新为 Leafer 贴图。
  - `setDirtyCanvas(true)` 不再请求全局重绘，只标记对应 `LegacyNodeHost` 需要重刷位图。
- **验收标准（Acceptance Criteria）**：
  - 在只读模式下，图中的旧节点能以位图形式显示在 Leafer 场景里。
  - 节点文本、基础外观、slot 基本可见，即使 hover、拖拽、菜单都尚未接通。
  - 单个节点触发脏更新时，只会重绘它自己的离屏位图，不会触发整图重刷。

## Phase 5: Restore Legacy Click Semantics
- **Phase 目标**：先打通旧节点最关键的点击交互，确保 `onMouseDown` 等内部 API 在 Leafer 下仍能跑通。
- **涉及文件**：
  - `E:/Code/litegraph.js/src/ts-migration/canvas/LGraphCanvas.input.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/InteractionController.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/LegacyPointerEventAdapter.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/HitTestService.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/LegacyNodeHost.ts`
- **动作细节**：
  - 新建 `InteractionController`，统一接收 Leafer `PointerEvent`。
  - 新建 `LegacyPointerEventAdapter`，把 Leafer 事件降级成旧节点期望的 `canvasX`、`canvasY`、`which`、`click_time`、`dragging` 等契约。
  - 节点命中测试优先由 Leafer UI 命中结果决定，再补充 slot/widget 局部坐标换算。
  - 旧 `processMouseDown()` 不再直接绑原生 DOM 事件，而改造成兼容分发逻辑，内部调用 legacy 节点的 `onMouseDown` / `onMouseMove` / `onMouseUp`。
- **验收标准（Acceptance Criteria）**：
  - 旧节点的点击、按钮类 widget、slot 命中判断恢复可用。
  - 控制台中不再依赖原生 `MouseEvent.offsetX/Y` 作为唯一坐标来源。
  - 仍可暂时不支持节点拖拽和复杂连接，但单击语义必须与旧节点内部 API 保持兼容。

## Phase 6: Hand Over Viewport Control
- **Phase 目标**：把画布平移与缩放从 `DragAndScale` 迁移到 Leafer viewport 体系。
- **涉及文件**：
  - `E:/Code/litegraph.js/src/ts-migration/canvas/DragAndScale.ts`
  - `E:/Code/litegraph.js/src/ts-migration/canvas/LGraphCanvas.input.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/ViewportController.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/LeaferAppHost.ts`
  - `E:/Code/litegraph.js/package.json`
- **动作细节**：
  - 引入并接管 `@leafer-in/viewport`，由 `ViewportController` 管理平移、滚轮缩放、触控板手势。
  - 废弃 `DragAndScale.mouseDrag()`、`changeScale()` 作为主实现，只保留必要的兼容数学工具或彻底删除。
  - 明确 wheel 策略是否需要保留“滚轮直接缩放”的旧行为；如需兼容，必须显式改写 viewport 默认配置。
  - 所有节点、连线、框选等世界空间元素统一挂在 `tree.zoomLayer` 或等价可缩放容器下。
- **验收标准（Acceptance Criteria）**：
  - 鼠标中键拖拽、滚轮缩放、触控板平移/缩放由 Leafer 侧接管。
  - 视口变化后，legacy 节点位图与 link 占位元素能同步跟随缩放和平移。
  - `DragAndScale` 即使保留文件，也不再承担生产路径里的主交互职责。

## Phase 7: Rebuild Drag, Selection, and Linking
- **Phase 目标**：接管复杂编辑交互，包括节点拖拽、多选框选、临时连线预览和连线提交。
- **涉及文件**：
  - `E:/Code/litegraph.js/src/ts-migration/canvas/LGraphCanvas.input.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/InteractionController.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/SelectionController.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/ConnectionController.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/NodePortAdapter.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/OverlayPrimitives.ts`
- **动作细节**：
  - 节点拖拽迁到 Leafer `DragEvent`，拖动时显式发出 `node:moved`，禁止依赖渲染阶段推导位移。
  - 框选矩形改为 `sky.overlayWorld` 上的 `UI.Rect`，拖拽连线预览改为 `UI.Path`，不再通过前景 canvas 擦除重画。
  - `ConnectionController` 负责从输出端口开始创建预览线，移动时更新终点，释放时提交 `connect()` 或取消。
  - 事件冲突采用分层阻止策略：端口与 widget `stopNow()`，节点主体拖拽 `stop()`，背景仅处理未消费事件。
- **验收标准（Acceptance Criteria）**：
  - 节点可拖拽，多选与框选可用。
  - 从端口拖出临时线并连接到目标端口可用，取消连接不会留下脏 UI。
  - 交互过程不再依赖 `drawFrontCanvas()` 的临时前景绘制。

## Phase 8: Optimize Mixed Runtime and Retire Canvas Host APIs
- **Phase 目标**：完成双轨运行时收口，支持 legacy 与 modern node 混排，并正式收敛旧 Canvas Host API。
- **涉及文件**：
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/ModernNodeHost.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/LegacyNodeHost.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/SceneSyncController.ts`
  - `E:/Code/litegraph.js/src/ts-migration/services/leafer/LinkViewHost.ts`
  - `E:/Code/litegraph.js/src/ts-migration/index.ts`
  - `E:/Code/litegraph.js/editor/js/litegraph-editor.js`
  - `E:/Code/litegraph.js/src/ts-migration/README.md`
- **动作细节**：
  - 新增 `ModernNodeHost`，让新节点通过 `buildUI()` / `updateUI()` / `getPortLayout()` 直接返回 Leafer 保留模式视图。
  - 统一 `NodePortAdapter` 与 `LinkViewHost`，确保 link 在 legacy bitmap 节点和 modern retained 节点之间都能正确路由。
  - 清理旧 Host API，对外只保留 Leafer runtime 所需最小入口；凡是“直接暴露原生 canvas / ctx”的宿主能力均允许删除。
  - 更新对外文档与迁移说明，明确“旧节点内部 API 兼容，调用端 Host API 已破坏性重构”的边界。
- **验收标准（Acceptance Criteria）**：
  - 同一张图中可同时存在 legacy 节点位图宿主与 modern Leafer 原生节点宿主。
  - 节点移动时只更新相关连线，不遍历整图 link。
  - 旧 Canvas Host API 不再是必需依赖；新调用端只需围绕 Leafer runtime 工作即可。

## Milestone Exit Rule
- Phase 1 到 Phase 4 完成后，应形成“只读可见”的最小可演示版本。
- Phase 5 到 Phase 7 完成后，应形成“可编辑”的 Leafer 主运行时。
- Phase 8 完成后，旧 Canvas 运行时仅作为内部兼容绘制器存在，不再作为产品主路径。
