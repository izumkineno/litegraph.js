# `src/ts-migration` 目录说明

本文档面向当前仓库里的 TS 迁移层实现，说明 `src/ts-migration` 下各目录和关键文件的职责。  
它描述的是“当前本地代码状态”，不是对外 API 手册。

## 配套文档

如果你想先看架构，再回到目录索引，建议先读：

- `../../guides/Architecture_Overview.md`
- `../../guides/Architecture_Data_Model.md`
- `../../guides/Architecture_Execution_Flow.md`
- `../../guides/Architecture_Extensibility_Guide.md`

## 整体定位

`ts-migration` 的目标不是做一套全新的图引擎，而是把原先集中在 `src/litegraph.js` 的核心实现拆成可维护的 TypeScript 分层，同时保留：

- 既有节点注册契约
- 历史序列化格式
- 全局挂载与 CommonJS 导出方式
- 旧画布与菜单 API 的兼容行为

当前主运行时已经收敛到 LeaferJS retained mode：

- `LGraphCanvas` 默认以 `renderRuntime: "leafer"` 工作
- 旧节点内部 API 继续兼容：
  - `onDrawBackground`
  - `onDrawForeground`
  - `onMouseDown / onMouseMove / onMouseUp`
  - `setDirtyCanvas`
- 但调用端 Host API 已发生破坏性重构：
  - 不应再依赖 `graphcanvas.canvas / bgcanvas / ctx / bgctx`
  - 不应再把 `draw()` / `drawFrontCanvas()` / `drawBackCanvas()` 当成主刷新入口
  - 调用端应围绕 Leafer runtime、scene sync 和 `requestRuntimeRender()` 工作

在当前仓库里，它已经是最清晰的架构表达，但它并不是唯一运行时来源：

- `src/litegraph.js` 与 `src/nodes/*.js` 仍然参与现有交付链路
- `src/ts-migration/**` 负责更清晰的装配、兼容、持久化和分层实现

## 先记住的几个事实

1. `index.ts` 只是装配入口，不再承担大块业务逻辑。
2. 默认模块导出会创建默认装配体，并导出：
   - `LiteGraph`
   - `registry`
   - `runtime`
   - `liteGraphMigrationBundle`
3. compat 已经收敛为单一真相：
   - `compat/compat-schema.ts`
   - `compat/compat-runtime.ts`
   - `types/litegraph-compat.ts`
4. persistence 已经拆成明确管线：
   - `serialization-repair`
   - `graph-serializer`
   - `graph-deserializer`
   - `LGraph.persistence` façade
5. 节点渲染现在是双轨制：
   - legacy node -> `leafer/LegacyNodeHost.ts`
   - modern node -> `leafer/ModernNodeHost.ts`
6. 新旧节点共用同一条连线与端口适配链：
   - `leafer/NodePortAdapter.ts`
   - `leafer/LinkViewHost.ts`
   - `leafer/SceneSyncController.ts`

## 目录分层

`src/ts-migration` 当前可以按 10 层理解：

- `core/`：`LiteGraph` 常量、命名空间、注册表、运行时 API
- `contracts/`：跨层最小契约，切断 `models -> canvas/ui` 的直接反向依赖
- `models/`：图、节点、连线、分组与 persistence 相关模型
- `canvas/`：画布生命周期、输入、遗留 canvas 兼容绘制、菜单与面板入口
- `services/`：从 canvas/ui 剥离出来的低频 UI 流程、resolver 与 Leafer runtime 服务
- `ui/`：独立 UI 组件
- `compat/`：兼容 schema、runtime、全局桥和 CommonJS 桥
- `types/`：核心共享类型、序列化类型、compat façade 类型导出
- `utils/`：纯工具函数
- `index.ts`：装配入口

## 继承与分层关系

### Graph 链

`LGraph.lifecycle.ts` -> `LGraph.execution.ts` -> `LGraph.structure.ts` -> `LGraph.io-events.ts` -> `LGraph.persistence.ts`

- 先定义图的生命周期和基础状态
- 再叠加执行调度
- 再叠加节点/分组结构管理
- 再叠加图级输入输出和事件
- 最后叠加 persistence façade

### Node 链

`LGraphNode.state.ts` -> `LGraphNode.execution.ts` -> `LGraphNode.ports-widgets.ts` -> `LGraphNode.connect-geometry.ts` -> `LGraphNode.canvas-collab.ts`

- 先定义节点状态和基础序列化
- 再叠加执行与触发能力
- 再叠加端口、属性、widgets
- 再叠加连线与几何逻辑
- 最后叠加与画布协作的行为

### Canvas 链

`LGraphCanvas.static.ts` -> `LGraphCanvas.lifecycle.ts` -> `LGraphCanvas.input.ts` -> `LGraphCanvas.render.ts` -> `LGraphCanvas.menu-panel.ts`

- 先定义画布基础结构与静态入口
- 再叠加生命周期
- 再叠加输入处理
- 再叠加绘制
- 最后叠加菜单与面板调度

## 文件索引

### 顶层

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `README.md` | 目录导航文档 | 说明 `src/ts-migration` 的分层、继承链和关键文件职责。 |
| `DECOUPLING_PERFORMANCE_ROADMAP.md` | 解耦与性能路线图 | 记录当前高耦合点、性能优先级和后续重构阶段。 |
| `index.ts` | 装配入口 | 暴露 `assembleLiteGraph()`，创建默认装配体，并导出 `LiteGraph / registry / runtime / liteGraphMigrationBundle`。 |

### `core/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `core/host-resolver.ts` | 统一 class host 解析器 | 提供带缓存的 `createClassHostResolver()`，收敛 graph / node / canvas 链里的默认 host 解析模式。 |
| `core/litegraph.constants.ts` | `LiteGraph` 静态常量与配置中心 | 定义形状、颜色、模式、默认值、配置项和 `LiteGraphConstantsShape`。 |
| `core/litegraph.constants.compat.ts` | 常量兼容层 | 处理 `GRID_SHAPE` / `SQUARE_SHAPE` 等别名差异。 |
| `core/litegraph.namespace.ts` | 命名空间构建器 | 构建 `LiteGraph` 命名空间、挂接 registry/runtime API、绑定各类 host，并接入 pointer compat。 |
| `core/litegraph.registry.ts` | 节点注册表 | 负责 `registerNodeType`、`unregisterNodeType`、`createNode`、分类查询和节点原型方法补齐。 |
| `core/litegraph.runtime.ts` | 运行时辅助 API | 负责 slot 类型登记、对象生成节点类、函数包装节点、连接合法性判断、搜索框扩展、文件抓取与对象克隆。 |

### `compat/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `compat/compat-schema.ts` | compat 单一真相（Schema） | 维护差异矩阵、compat host 契约与序列化兼容 schema。 |
| `compat/compat-runtime.ts` | compat 运行时装配 | 基于 schema 统一实现常量别名、Canvas shim、ContextMenu 对齐和序列化兼容 helper。 |
| `compat/cjs-exports.ts` | CommonJS 导出桥 | 把装配好的 `LiteGraph`、构造器和相关符号挂到 `module.exports` / `exports` 风格对象。 |
| `compat/global-bridge.ts` | 全局对象桥 | 把 `LiteGraph`、`LGraph`、`LGraphNode`、`LGraphCanvas` 等挂到 `window` / `globalThis`，并补充时间与动画帧兼容。 |
| `compat/litegraph-assembly-bridges.ts` | assembly bridge 调度层 | 统一处理装配完成后的全局桥和 CJS 桥挂载。 |
| `compat/litegraph-assembly-compat.ts` | assembly compat 调度层 | 把入口期的 compat apply 逻辑从 `index.ts` 中抽离。 |
| `compat/pointer-events.ts` | 指针事件兼容层 | 统一 mouse / pointer / touch 三类事件及监听器挂载。 |
| `compat/time-source.ts` | 时间源兼容层 | 提供统一的 `getTime` 来源并挂接到运行时 host。 |

### `contracts/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `contracts/canvas.ts` | 画布最小契约层 | 定义 `models/types` 所需的最小画布 port。 |
| `contracts/ui.ts` | UI 最小契约层 | 定义 `ContextMenuPort` 等底层可依赖的最小 UI 契约。 |

### `models/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `models/LGraph.lifecycle.ts` | 图对象基础生命周期 | 定义 `LGraph` 的基础字段、清理逻辑、画布挂载/卸载和执行循环生命周期骨架。 |
| `models/LGraph.execution.ts` | 图执行调度层 | 实现 `runStep()`、执行计时、执行顺序更新、拓扑排序和布局辅助。 |
| `models/LGraph.structure.ts` | 图结构管理层 | 实现节点/分组的增删查、按标题/类型查找和坐标命中逻辑。 |
| `models/LGraph.io-events.ts` | 图级输入输出与事件层 | 管理 graph 级 input/output、`onAction` / `trigger` / `sendEventToAllNodes` 以及向 canvas 的广播。 |
| `models/LGraph.persistence.ts` | 图持久化 façade | 编排序列化和反序列化流程、`load()` 和 `removeLink()`。 |
| `models/graph-persistence.types.ts` | 持久化共享类型 | 提供 graph persistence 相关的 host、工厂、repair 结果和 façade 共享类型。 |
| `models/serialization-repair.ts` | 序列化修补层 | 负责历史遗留数据清洗、坏 link 修补、未知节点 fallback。 |
| `models/graph-serializer.ts` | 纯序列化器 | 只负责把标准 graph / node / group / link 实例映射成序列化对象。 |
| `models/graph-deserializer.ts` | 纯反序列化器 | 只负责把修补后的序列化对象实例化回 graph 数据结构。 |
| `models/LGraph.hooks.ts` | 图钩子兼容层 | 集中处理 `onNodeAdded` 等历史钩子的兼容调用。 |
| `models/LGraphGroup.ts` | 节点分组模型 | 定义 group 的位置、尺寸、标题、颜色、命中判断、移动和序列化逻辑。 |
| `models/LGraphGroup.serialization.compat.ts` | 分组序列化兼容层 | 处理 group 在运行时与声明层之间的字段差异。 |
| `models/LLink.ts` | 连线模型 | 定义 link 的源/目标节点、slot、类型和序列化方法。 |
| `models/LLink.serialization.compat.ts` | 连线序列化兼容层 | 处理 link tuple 顺序和不同 shape 的兼容输入。 |
| `models/LGraphNode.state.ts` | 节点基础状态层 | 定义节点的 ID、标题、位置、尺寸、属性、flags、模式和基础序列化状态。 |
| `models/LGraphNode.execution.ts` | 节点执行层 | 实现 `doExecute`、`actionDo`、`trigger`、`triggerSlot`、延迟 action 和节点级运行路径。 |
| `models/LGraphNode.ports-widgets.ts` | 节点端口与 widgets 层 | 负责输入/输出端口、属性、widgets、动态 slot 和节点尺寸辅助。 |
| `models/LGraphNode.connect-geometry.ts` | 节点连线与几何层 | 负责连接/断开、slot 坐标、命中判断、连接点几何与布局尺寸辅助。 |
| `models/LGraphNode.canvas-collab.ts` | 节点与画布协作层 | 负责 dirty canvas、图片加载、输入捕获、折叠/固定和局部坐标到屏幕坐标转换。 |

### `canvas/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `canvas/DragAndScale.ts` | 拖拽与缩放视图控制器 | 维护 offset / scale，处理平移、缩放和坐标转换。 |
| `canvas/LGraphCanvas.static.ts` | 画布基类与静态 API | 定义 `LGraphCanvas` 的基础结构和一批静态入口。 |
| `canvas/LGraphCanvas.static.compat.ts` | 画布静态 API 兼容层 | 处理 `onResizeNode`、subgraph 菜单等历史静态 API 差异。 |
| `canvas/LGraphCanvas.lifecycle.ts` | 画布生命周期层 | 负责构造、绑定 graph、切换画布、resize、dirty 标记、live mode 和事件监听安装与卸载。 |
| `canvas/LGraphCanvas.input.ts` | 画布输入处理层 | 处理鼠标、键盘、触屏、滚轮交互，以及选中、拖拽、拉线、框选和快捷键。 |
| `canvas/LGraphCanvas.render.ts` | 画布渲染层 | 负责背景、groups、nodes、links、widgets 和前景覆盖层的绘制。 |
| `canvas/LGraphCanvas.menu-panel.ts` | 菜单与面板入口层 | 现在只保留菜单 / 面板入口调度和薄包装；真实 DOM 与低频流程已迁到 `services/`。 |

### `services/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `services/connection-menu-controller.ts` | 连接菜单控制器 | 处理 slot 连线菜单、默认节点创建和 `Add Node/Search` 分支。 |
| `services/context-menu-action-builder.ts` | 菜单项构建器 | 生成 canvas/node/group/slot 菜单项数组。 |
| `services/context-menu-controller.ts` | 右键菜单流程控制器 | 负责命中 slot / node / canvas / group 后的菜单分发。 |
| `services/dialog-factory.ts` | 对话框工厂 | 构造通用 dialog DOM 并统一挂载。 |
| `services/floating-ui-service.ts` | 浮层基础设施 | 统一 document/window 解析、挂载根选择、outside click、leave close 和 cleanup。 |
| `services/graph-options-panel-presenter.ts` | 图设置面板 presenter | 渲染 canvas options 与 link render mode 面板。 |
| `services/link-menu-controller.ts` | 链路菜单控制器 | 处理 link 右键菜单与 link 删除等低频交互。 |
| `services/menu-class-resolver.ts` | 菜单静态能力 resolver | 把 `LGraphCanvas.static` 的静态能力包装成已解析 port。 |
| `services/menu-host-resolver.ts` | 菜单 host resolver | 归一化 `menu-panel` 所需 host 默认值并做缓存。 |
| `services/menu-panel-types.ts` | 菜单/面板共享类型 | 提供 dialog/panel 结构与菜单上下文 port。 |
| `services/node-panel-presenter.ts` | 节点面板 presenter | 渲染节点属性面板、颜色/模式编辑和删除流程。 |
| `services/panel-factory.ts` | 面板工厂 | 构造设置面板和属性面板 DOM，并统一挂载与销毁。 |
| `services/prompt-dialog-controller.ts` | Prompt 控制器 | 负责 prompt 输入弹层及确认/取消流程。 |
| `services/property-value-dialog-controller.ts` | 属性值编辑弹层 | 处理字符串、数字、数组、对象、枚举、布尔等属性编辑 UI。 |
| `services/searchbox-controller.ts` | 搜索框控制器 | 负责节点搜索、过滤、自动补全、type filter 和搜索框浮层生命周期。 |
| `services/subgraph-io-panel-presenter.ts` | 子图 IO 面板 presenter | 负责子图 inputs/outputs 面板的渲染和增删 slot 流程。 |

`leafer/` 当前是 retained-mode 主运行时的核心目录，重点文件包括：

- `LeaferAppHost.ts`：创建 `App` 与 `ground/tree/sky` 根层
- `ViewportController.ts`：接管平移缩放
- `GraphMutationBus.ts`：graph 结构变更总线
- `SceneSyncController.ts`：领域模型到 Leafer scene graph 的单向同步
- `LegacyNodeHost.ts`：旧节点位图镜像宿主
- `ModernNodeHost.ts`：新节点原生 Leafer UI 宿主
- `NodePortAdapter.ts`：统一端口与连线路由适配
- `LinkViewHost.ts`：Leafer 连线视图包装
- `InteractionController.ts` / `SelectionController.ts` / `ConnectionController.ts`：编辑交互主链

### `ui/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `ui/ContextMenu.ts` | 通用右键菜单组件 | 实现菜单 DOM、子菜单、递归关闭与菜单项执行。 |
| `ui/context-menu-compat.ts` | 菜单关闭兼容层 | 兼容 `LiteGraph.closeAllContextMenus` 等历史接口。 |
| `ui/CurveEditor.ts` | 曲线编辑器组件 | 提供节点/属性面板中可复用的曲线编辑 UI。 |

### `types/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `types/core-types.ts` | 核心共享类型 | 定义向量、slot、widget、节点/画布/菜单等基础类型。 |
| `types/serialization.ts` | 序列化类型定义 | 定义 graph / node / link / group 的序列化结构。 |
| `types/litegraph-compat.ts` | 兼容 façade 导出 | 对外稳定导出 compat schema/runtime 能力，不再维护独立实现。 |
| `types/litegraph-compat.d.ts` | 兼容声明 façade | re-export 由 `compat-schema.ts` / `compat-runtime.ts` 推导出的声明。 |
| `types/contract-diff-matrix.md` | 兼容差异说明文档 | 人类可读版差异矩阵，记录运行时与声明层不一致处及兼容策略。 |

### `utils/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `utils/clamp.ts` | 数值钳制工具 | 提供 `clamp()` 及全局挂载辅助。 |
| `utils/color.ts` | 颜色转换工具 | 提供颜色标准化、十六进制与 RGB 数组之间的转换。 |
| `utils/function-signature.ts` | 函数签名工具 | 解析函数参数名，用于 `wrapFunctionAsNode()`。 |
| `utils/math-geometry.ts` | 几何与比较工具 | 提供对象比较、点距、矩形命中和 bounding 辅助。 |

## 阅读建议

如果要快速理解迁移层，建议按下面顺序阅读：

1. `../../guides/Architecture_Overview.md`
2. `index.ts`
3. `core/litegraph.namespace.ts`
4. `core/litegraph.registry.ts`
5. `core/litegraph.runtime.ts`
6. `models/LGraph.*`
7. `models/LGraphNode.*`
8. `models/serialization-repair.ts`
9. `models/graph-serializer.ts`
10. `models/graph-deserializer.ts`
11. `canvas/LGraphCanvas.*`
12. `services/*`
13. `compat/*`

## 维护建议

- 新增 compat 行为时，先改 `compat-schema.ts`，再改 `compat-runtime.ts`，最后补 façade 和文档。
- 新增 persistence 兼容时，优先放进 `serialization-repair.ts` 或序列化兼容层，不要回流到图模型主流程。
- 新增低频 UI 逻辑时，优先落到 `services/`，不要继续把 `menu-panel` 扩回“大而全”类。
- 扩展节点注册、搜索与 slot 类型时，优先走 `litegraph.registry.ts` 和 `litegraph.runtime.ts` 暴露的统一入口。
