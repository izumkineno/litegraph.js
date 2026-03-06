# `src/ts-migration` 目录说明

本文档面向当前仓库里的 TS 迁移层实现，说明 `src/ts-migration` 下每个文件的职责、主要内容和它在整体架构里的位置。  
对应的是当前仓库现状，不是对外 API 文档。

## 整体定位

`ts-migration` 的目标不是重做一套新产品，而是把原先集中在 [`src/litegraph.js`](../litegraph.js) 的单文件实现，拆成可维护的 TypeScript 分层结构，同时保留对既有运行时契约、序列化格式和全局挂载方式的兼容。

截至当前仓库状态，迁移层已经完成了 contracts 解耦、host resolver 收敛、assembly 入口瘦身、canvas 冷路径 UI 服务化、统一浮层基础设施、compat 单一真相，以及 persistence 的 `repair + serializer + deserializer + facade` 分层。

目录大体分成 10 层：

- `core/`: `LiteGraph` 常量、注册表、运行时辅助 API。
- `contracts/`: 跨层最小契约，切断 `models/types -> canvas/ui` 的反向依赖。
- `models/`: 图、节点、分组、连线等核心数据模型。
- `canvas/`: 画布类本体，包含生命周期、输入处理、渲染、菜单与面板。
- `services/`: 从 canvas / ui 剥离出来的低频 UI 服务、菜单控制器和 resolver。
- `ui/`: 独立 UI 组件，如右键菜单、曲线编辑器。
- `compat/`: 对全局环境、CJS、事件模型、时间源的兼容桥。
- `types/`: 类型定义、兼容差异矩阵、序列化类型。
- `utils/`: 纯工具函数。
- `index.ts`: 极薄装配入口，只负责调度 namespace 构建、compat apply 和 bridge 挂载。

## 继承与分层关系

### Graph 链

`LGraph.lifecycle.ts` -> `LGraph.execution.ts` -> `LGraph.structure.ts` -> `LGraph.io-events.ts` -> `LGraph.persistence.ts`

- 先定义图的生命周期和基础状态。
- 再叠加执行调度。
- 再叠加节点/分组结构管理。
- 再叠加图级输入输出和事件。
- 最后叠加序列化、反序列化、加载。

### Node 链

`LGraphNode.state.ts` -> `LGraphNode.execution.ts` -> `LGraphNode.ports-widgets.ts` -> `LGraphNode.connect-geometry.ts` -> `LGraphNode.canvas-collab.ts`

- 先定义节点本身的状态和基本序列化。
- 再叠加执行和事件触发能力。
- 再叠加端口、属性、Widget。
- 再叠加连线和几何计算。
- 最后叠加与画布协作的行为。

### Canvas 链

`LGraphCanvas.static.ts` -> `LGraphCanvas.lifecycle.ts` -> `LGraphCanvas.input.ts` -> `LGraphCanvas.render.ts` -> `LGraphCanvas.menu-panel.ts`

- 先定义基类和静态 API 入口。
- 再叠加画布生命周期。
- 再叠加输入事件。
- 再叠加绘制。
- 最后叠加菜单、对话框、属性面板、搜索框。

## 文件逐项说明

### 顶层

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `README.md` | 目录导航文档 | 说明 `src/ts-migration` 的分层结构、继承链以及每个文件的职责与主要内容。 |
| `DECOUPLING_PERFORMANCE_ROADMAP.md` | 解耦与性能路线图 | 记录 `ts-migration` 当前的高耦合点、性能优先级和建议重构阶段，供后续结构收敛参考。 |
| `index.ts` | 迁移层总装配入口 | 只保留 `assembleLiteGraph()` 调度，调用 `core/litegraph.namespace.ts` 构建命名空间，再交给 `compat/litegraph-assembly-*` 处理兼容和 bridge。 |

### `core/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `core/host-resolver.ts` | 统一 class host 解析器 | 提供带缓存的 `createClassHostResolver()`，把 graph / node / canvas 链里重复的 `defaultHost + getHost()` 模板收敛成单一实现。 |
| `core/litegraph.constants.ts` | `LiteGraph` 静态常量与配置中心 | 定义形状、颜色、模式、默认值、配置项和 `LiteGraphConstantsShape`，是整个命名空间的静态配置基底。 |
| `core/litegraph.constants.compat.ts` | 常量兼容层 | 处理 `GRID_SHAPE` / `SQUARE_SHAPE` 之类的别名差异，保证 TS 运行时和旧 JS 契约一致。 |
| `core/litegraph.namespace.ts` | 命名空间构建器 | 构建 `LiteGraph` 命名空间、装配 registry/runtime/class host、接入 pointer compat，是 `index.ts` 的主要后端。 |
| `core/litegraph.registry.ts` | 节点类型注册表 | 负责 `registerNodeType`、`unregisterNodeType`、`createNode`、分类查询、给所有节点补充方法等注册表行为。 |
| `core/litegraph.runtime.ts` | `LiteGraph` 运行时辅助 API | 负责 slot 类型登记、从对象生成节点类、函数包装节点、连接合法性判断、搜索框扩展、文件抓取、对象克隆等。 |

### `compat/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `compat/cjs-exports.ts` | CommonJS 导出桥 | 把装配好的 `LiteGraph`、构造器和相关符号挂到 `module.exports` / `exports` 风格对象上。 |
| `compat/global-bridge.ts` | 全局对象桥 | 把 `LiteGraph`、`LGraph`、`LGraphNode`、`LGraphCanvas` 等挂到 `window` / `globalThis`，并补 `requestAnimationFrame` shim。 |
| `compat/litegraph-assembly-bridges.ts` | assembly bridge 调度层 | 把 `index.ts` 中的 `global bridge` / `cjs bridge` 剥离出来，统一处理入口装配后的可选挂载。 |
| `compat/litegraph-assembly-compat.ts` | assembly compat 调度层 | 把入口期的 compat apply 逻辑从 `index.ts` 下放为独立模块，保证入口只有 orchestration。 |
| `compat/pointer-events.ts` | 指针事件兼容层 | 统一 mouse / pointer / touch 三类事件，提供事件名解析、touch 归一化、监听器添加和移除。 |
| `compat/time-source.ts` | 时间源兼容层 | 提供 `createTimeSource()` / `attachTimeSource()`，把统一的 `getTime` 接到运行时 host。 |

### `contracts/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `contracts/canvas.ts` | 画布最小契约层 | 定义 `GraphCanvas*Port` 系列接口，只暴露 `models/types` 真实需要的最小画布能力。 |
| `contracts/ui.ts` | UI 最小契约层 | 定义 `ContextMenuPort` 等低层可依赖的 UI 契约，避免底层直接依赖具体组件实现。 |

### `models/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `models/LGraph.lifecycle.ts` | 图对象基础生命周期 | 定义 `LGraph` 的基础字段、清理逻辑、画布挂载/卸载、运行状态以及执行循环的生命周期骨架。 |
| `models/LGraph.execution.ts` | 图执行调度层 | 实现 `runStep()`、执行计时、执行顺序更新、拓扑排序、节点布局等执行相关逻辑。 |
| `models/LGraph.structure.ts` | 图结构管理层 | 实现节点/分组的 `add`、`remove`、`getNodeById`、按标题/类型查找、按坐标命中节点或分组。 |
| `models/LGraph.io-events.ts` | 图级输入输出与事件层 | 管理 graph 级 input/output、触发 `onAction` / `trigger` / `sendEventToAllNodes`，并向 canvas 广播变更。 |
| `models/LGraph.persistence.ts` | 图持久化门面 | 现在只负责编排 `repair -> serializer/deserializer` 流程、`load()` 和 `removeLink()`，不再内嵌历史修补细节。 |
| `models/graph-persistence.types.ts` | 持久化共享端口与 DTO 类型 | 提供 graph persistence 相关的 host、工厂、repair 结果和 facade 之间共享的最小类型。 |
| `models/serialization-repair.ts` | 序列化修补层 | 负责历史遗留数据清洗、坏 link 过滤、未知节点 fallback 构造，是 persistence 的数据防腐层。 |
| `models/graph-serializer.ts` | 纯序列化器 | 只负责把标准 graph / node / group / link 实例映射成序列化对象，不承担修补逻辑。 |
| `models/graph-deserializer.ts` | 纯反序列化器 | 只负责把清洗后的序列化对象实例化回 graph 数据结构，依赖外部注入的工厂，不做兼容 if-else。 |
| `models/LGraph.hooks.ts` | 图钩子兼容层 | 把 `onNodeAdded` 这类历史钩子抽成兼容判断与调用函数，避免不同契约散落在业务代码里。 |
| `models/LGraphGroup.ts` | 节点分组模型 | 定义 group 的位置、尺寸、标题、颜色、命中判断、移动、序列化/反序列化和包围盒更新。 |
| `models/LGraphGroup.serialization.compat.ts` | 分组序列化兼容层 | 处理 group 在 JS 运行时和 d.ts 之间的字段差异，提供 normalize / denormalize / parse / serialize。 |
| `models/LLink.ts` | 连线模型 | 定义 link 的源/目标节点、slot、类型和序列化方法，是 graph.links 的基础实体。 |
| `models/LLink.serialization.compat.ts` | 连线序列化兼容层 | 处理 link tuple 顺序、只读 tuple 输入、shape 输入等兼容问题，统一连线序列化入口。 |
| `models/LGraphNode.state.ts` | 节点基础状态层 | 定义节点的 ID、标题、位置、尺寸、属性、flags、模式、基础序列化状态和通用数据结构。 |
| `models/LGraphNode.execution.ts` | 节点执行层 | 负责 `doExecute`、`actionDo`、`trigger`、`triggerSlot`、延迟 action、模式执行和节点级运行路径。 |
| `models/LGraphNode.ports-widgets.ts` | 节点端口与 Widget 层 | 负责输入/输出端口、属性、widgets、widget 回调、动态 slot、节点尺寸相关辅助。 |
| `models/LGraphNode.connect-geometry.ts` | 节点连线与几何层 | 负责连接/断开连接、slot 坐标计算、矩形命中、连接点几何、布局尺寸和若干画布命中基础能力。 |
| `models/LGraphNode.canvas-collab.ts` | 节点与画布协作层 | 负责对齐网格、trace、标记 dirty canvas、加载图片、输入捕获、折叠/固定节点、局部坐标转屏幕坐标。 |

### `canvas/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `canvas/DragAndScale.ts` | 拖拽与缩放视图控制器 | 维护画布 offset / scale，处理平移、缩放和坐标转换，是 canvas 视口操作的独立工具类。 |
| `canvas/LGraphCanvas.static.ts` | 画布基类与静态 API | 定义 `LGraphCanvas` 的基础结构和一批静态入口，是整个 canvas 继承链的起点。 |
| `canvas/LGraphCanvas.static.compat.ts` | 画布静态 API 兼容层 | 解决 `onResizeNode` / `onMenuResizeNode`、subgraph 菜单入口等历史静态 API 名称差异，并对缺失 API 做 guard。 |
| `canvas/LGraphCanvas.lifecycle.ts` | 画布生命周期层 | 负责构造、绑定 graph、切换画布、resize、dirty 标记、live mode、背景图、事件监听安装与卸载。 |
| `canvas/LGraphCanvas.input.ts` | 画布输入处理层 | 处理鼠标、键盘、触屏、滚轮交互，包括选中、拖拽、拉线、断线、框选、快捷键和基础上下文菜单触发。 |
| `canvas/LGraphCanvas.render.ts` | 画布渲染层 | 负责背景、groups、nodes、links、widgets、前景覆盖层的绘制，以及 `fps` / `render_time` 统计。 |
| `canvas/LGraphCanvas.menu-panel.ts` | 菜单与面板入口层 | 现在只保留菜单 / 面板入口调度、状态注入和 `createDialog/createPanel` 薄包装；真实 DOM 与业务流程已迁到 `services/`。 |

### `services/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `services/connection-menu-controller.ts` | 连接菜单控制器 | 负责 slot 连线菜单、默认节点创建、`Add Node/Search` 分支与连接型菜单回调。 |
| `services/context-menu-action-builder.ts` | 菜单项构建器 | 专门生成 canvas/node/group/slot 菜单项数组，把菜单结构与 Canvas 主类解耦。 |
| `services/context-menu-controller.ts` | 右键菜单流程控制器 | 负责命中 slot / node / canvas / group 后的菜单分发与 slot 特殊动作处理。 |
| `services/dialog-factory.ts` | 对话框工厂 | 负责通用 dialog DOM 构造、键盘交互，并通过 `floating-ui-service` 统一挂载与关闭。 |
| `services/floating-ui-service.ts` | 浮层基础设施 | 统一 document/window 解析、挂载根选择、outside click、close on leave、body overflow 锁和安全销毁。 |
| `services/graph-options-panel-presenter.ts` | 图设置面板 presenter | 渲染 canvas options 与 link render mode 面板，不直接依赖具体 `LGraphCanvas` 类。 |
| `services/link-menu-controller.ts` | 链路菜单控制器 | 负责 link 右键菜单与 link 删除等低频交互。 |
| `services/menu-class-resolver.ts` | 菜单静态能力 resolver | 把 `LGraphCanvas.static` 的菜单静态方法、`active_canvas`、`node_colors` 等包装成已解析 port。 |
| `services/menu-host-resolver.ts` | 菜单 host resolver | 对 `menu-panel` 所需的 host 默认值做统一归一化和缓存，避免入口层重复 spread 大对象。 |
| `services/menu-panel-types.ts` | 菜单/面板服务共享类型 | 提供 dialog/panel 结构、菜单上下文 port 和服务间共享的 UI 类型。 |
| `services/node-panel-presenter.ts` | 节点面板 presenter | 负责节点属性面板、颜色/模式编辑、代码编辑区切换与删除按钮流程。 |
| `services/panel-factory.ts` | 面板工厂 | 构造设置面板/属性面板 DOM，现已统一通过 `floating-ui-service` 挂载与销毁。 |
| `services/prompt-dialog-controller.ts` | Prompt 控制器 | 负责 prompt 输入弹层、确认/取消和与 Canvas 状态的同步。 |
| `services/property-value-dialog-controller.ts` | 属性值编辑弹层 | 处理字符串、数字、数组、对象、枚举、布尔等属性编辑 UI 与回写逻辑。 |
| `services/searchbox-controller.ts` | 搜索框控制器 | 负责节点搜索、过滤、自动补全、连线型 type filter 和搜索框浮层生命周期。 |
| `services/subgraph-io-panel-presenter.ts` | 子图 IO 面板 presenter | 负责子图 inputs/outputs 面板的渲染、增删 slot 和刷新逻辑。 |

### `ui/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `ui/ContextMenu.ts` | 通用右键菜单组件 | 实现菜单 DOM、子菜单、递归关闭与菜单项执行；挂载、边界裁切、outside click 和 leave 关闭已统一接入 `floating-ui-service`。 |
| `ui/context-menu-compat.ts` | 菜单关闭兼容层 | 兼容 `LiteGraph.closeAllContextMenus` 一类历史接口，把 “关闭全部菜单” 抽成明确的兼容层。 |
| `ui/CurveEditor.ts` | 曲线编辑器组件 | 提供节点/属性面板中可复用的曲线编辑 UI，负责点编辑、曲线显示和坐标映射。 |

### `types/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `types/core-types.ts` | 核心共享类型 | 定义向量、slot、widget、节点/画布/菜单接口等基础类型，是其他 TS 文件的公共类型底座。 |
| `types/serialization.ts` | 序列化类型定义 | 定义 graph / node / link / group 的序列化结构和泛型版本，给持久化层和兼容层复用。 |
| `compat/compat-schema.ts` | compat 单一真相（Schema） | 维护 `LITEGRAPH_API_DIFF_MATRIX`、diff ids、compat host 契约和序列化兼容类型，是兼容层的唯一 schema 来源。 |
| `compat/compat-runtime.ts` | compat 运行时装配 | 维护 compat apply façade 和基于 schema 的运行时映射，统一聚合常量别名、canvas shim、ContextMenu 对齐等 helper。 |
| `types/litegraph-compat.ts` | 兼容门面导出 | 对外稳定导出 compat schema/runtime 能力，本身不再维护独立实现。 |
| `types/litegraph-compat.d.ts` | 兼容声明门面 | 仅 re-export 由 `compat-schema.ts` / `compat-runtime.ts` 推导出的类型与函数声明，不再手写镜像契约。 |
| `types/contract-diff-matrix.md` | 兼容差异说明文档 | 人类可读版差异矩阵，记录 JS 运行时和 d.ts 契约不一致处，以及兼容策略与后续收敛任务。 |

### `utils/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `utils/clamp.ts` | 数值钳制工具 | 提供 `clamp()` 和把该函数挂到全局作用域的辅助方法。 |
| `utils/color.ts` | 颜色转换工具 | 提供颜色字符串标准化、十六进制与 RGB 数组之间的相互转换。 |
| `utils/function-signature.ts` | 函数签名工具 | 通过字符串解析函数参数名，用于 `wrapFunctionAsNode()` 这类把函数包装成节点的场景。 |
| `utils/math-geometry.ts` | 几何与比较工具 | 提供对象比较、点距、矩形命中、bounding 扩展/重叠判断等，被节点和画布几何逻辑复用。 |

## 阅读建议

如果要快速理解迁移层，建议按下面顺序阅读：

1. `index.ts`
2. `core/litegraph.namespace.ts`、`core/host-resolver.ts`
3. `contracts/*`
4. `core/litegraph.constants.ts`、`core/litegraph.registry.ts`、`core/litegraph.runtime.ts`
5. Graph 链：`models/LGraph.*`，然后接着看 `models/serialization-repair.ts`、`models/graph-serializer.ts`、`models/graph-deserializer.ts`
6. Node 链：`models/LGraphNode.*`
7. Canvas 链：`canvas/LGraphCanvas.*`
8. `services/*`
9. `ui/ContextMenu.ts`
10. `compat/*`、`compat/compat-schema.ts` 与 `types/litegraph-compat.ts`

## 现状备注

- 目录里的 `TODO: Import ... from its future module` 注释已经完成清理；当前阶段的重点已经转向 contracts、resolver、services 三层的边界稳定化。
- `models/types -> canvas/ui` 的直接反向依赖已经通过 `contracts/` 初步切断；继续重构时应优先扩展 port，而不是重新引入具体类引用。
- `index.ts` 已经收回成 assembly 入口，真正的 namespace 构建、compat apply 和 bridge 挂载都已经拆到独立模块。
- `canvas/LGraphCanvas.menu-panel.ts` 已经从“大而全 UI 类”收缩成薄调度层；低频 DOM 构造和菜单流程主要位于 `services/`。
- 浮层类 UI 现在共享 `floating-ui-service.ts`；新增弹层时，应优先复用这套挂载、outside click、leave close 和 cleanup 机制。
- compat 已经建立 `compat-schema.ts -> compat-runtime.ts -> facade/.d.ts` 的单一真相；后续新增 diff 项时，应先改 schema，再补 runtime 和文档，而不是反过来。
- persistence 已经按 `serialization-repair -> graph-deserializer/graph-serializer -> LGraph.persistence facade` 分层；历史数据兼容不应再回流进图模型本体。
- 如果后续继续推进重构，这份目录最需要优先收敛的是：
  - `ui/ContextMenu.ts` 和其 host 解析模式的进一步收口
  - `render/input/execution` 高频路径上的对象分配和命中逻辑
  - 基于 `rbush` 的节点/分组空间索引与框选命中优化
