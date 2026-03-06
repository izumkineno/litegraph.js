# `src/ts-migration` 目录说明

本文档面向当前仓库里的 TS 迁移层实现，说明 `src/ts-migration` 下每个文件的职责、主要内容和它在整体架构里的位置。  
对应的是当前仓库现状，不是对外 API 文档。

## 整体定位

`ts-migration` 的目标不是重做一套新产品，而是把原先集中在 [`src/litegraph.js`](../litegraph.js) 的单文件实现，拆成可维护的 TypeScript 分层结构，同时保留对既有运行时契约、序列化格式和全局挂载方式的兼容。

目录大体分成 8 层：

- `core/`: `LiteGraph` 常量、注册表、运行时辅助 API。
- `models/`: 图、节点、分组、连线等核心数据模型。
- `canvas/`: 画布类本体，包含生命周期、输入处理、渲染、菜单与面板。
- `ui/`: 独立 UI 组件，如右键菜单、曲线编辑器。
- `compat/`: 对全局环境、CJS、事件模型、时间源的兼容桥。
- `types/`: 类型定义、兼容差异矩阵、序列化类型。
- `utils/`: 纯工具函数。
- `index.ts`: 组装入口，把上面所有层拼成最终 `LiteGraph` 命名空间。

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
| `index.ts` | 迁移层总装配入口 | 组装 `LiteGraph` 命名空间，拼接 `core`、`models`、`canvas`、`ui`、`compat`，导出 `assembleLiteGraph()`，并支持挂到全局或 CommonJS。 |

### `core/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `core/litegraph.constants.ts` | `LiteGraph` 静态常量与配置中心 | 定义形状、颜色、模式、默认值、配置项和 `LiteGraphConstantsShape`，是整个命名空间的静态配置基底。 |
| `core/litegraph.constants.compat.ts` | 常量兼容层 | 处理 `GRID_SHAPE` / `SQUARE_SHAPE` 之类的别名差异，保证 TS 运行时和旧 JS 契约一致。 |
| `core/litegraph.registry.ts` | 节点类型注册表 | 负责 `registerNodeType`、`unregisterNodeType`、`createNode`、分类查询、给所有节点补充方法等注册表行为。 |
| `core/litegraph.runtime.ts` | `LiteGraph` 运行时辅助 API | 负责 slot 类型登记、从对象生成节点类、函数包装节点、连接合法性判断、搜索框扩展、文件抓取、对象克隆等。 |

### `compat/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `compat/cjs-exports.ts` | CommonJS 导出桥 | 把装配好的 `LiteGraph`、构造器和相关符号挂到 `module.exports` / `exports` 风格对象上。 |
| `compat/global-bridge.ts` | 全局对象桥 | 把 `LiteGraph`、`LGraph`、`LGraphNode`、`LGraphCanvas` 等挂到 `window` / `globalThis`，并补 `requestAnimationFrame` shim。 |
| `compat/pointer-events.ts` | 指针事件兼容层 | 统一 mouse / pointer / touch 三类事件，提供事件名解析、touch 归一化、监听器添加和移除。 |
| `compat/time-source.ts` | 时间源兼容层 | 提供 `createTimeSource()` / `attachTimeSource()`，把统一的 `getTime` 接到运行时 host。 |

### `models/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `models/LGraph.lifecycle.ts` | 图对象基础生命周期 | 定义 `LGraph` 的基础字段、清理逻辑、画布挂载/卸载、运行状态以及执行循环的生命周期骨架。 |
| `models/LGraph.execution.ts` | 图执行调度层 | 实现 `runStep()`、执行计时、执行顺序更新、拓扑排序、节点布局等执行相关逻辑。 |
| `models/LGraph.structure.ts` | 图结构管理层 | 实现节点/分组的 `add`、`remove`、`getNodeById`、按标题/类型查找、按坐标命中节点或分组。 |
| `models/LGraph.io-events.ts` | 图级输入输出与事件层 | 管理 graph 级 input/output、触发 `onAction` / `trigger` / `sendEventToAllNodes`，并向 canvas 广播变更。 |
| `models/LGraph.persistence.ts` | 图持久化层 | 负责 `serialize()`、`configure()`、`load()`、`removeLink()`，以及反序列化失败时的 fallback 节点策略。 |
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
| `canvas/LGraphCanvas.menu-panel.ts` | 菜单与面板层 | 负责右键菜单、搜索框、属性面板、图设置面板、子图 IO 面板、对话框和面板型 UI 的构建与流程。 |

### `ui/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `ui/ContextMenu.ts` | 通用右键菜单组件 | 实现菜单 DOM、子菜单、定位、关闭、hover/leave 行为，是 canvas 菜单系统的基础组件。 |
| `ui/context-menu-compat.ts` | 菜单关闭兼容层 | 兼容 `LiteGraph.closeAllContextMenus` 一类历史接口，把 “关闭全部菜单” 抽成明确的兼容层。 |
| `ui/CurveEditor.ts` | 曲线编辑器组件 | 提供节点/属性面板中可复用的曲线编辑 UI，负责点编辑、曲线显示和坐标映射。 |

### `types/`

| 文件 | 作用 | 主要内容 |
| --- | --- | --- |
| `types/core-types.ts` | 核心共享类型 | 定义向量、slot、widget、节点/画布/菜单接口等基础类型，是其他 TS 文件的公共类型底座。 |
| `types/serialization.ts` | 序列化类型定义 | 定义 graph / node / link / group 的序列化结构和泛型版本，给持久化层和兼容层复用。 |
| `types/litegraph-compat.ts` | 兼容差异矩阵（运行时侧） | 维护 `LITEGRAPH_API_DIFF_MATRIX` 和一组 compat 类型/辅助函数，是迁移期契约差异的机器可读来源。 |
| `types/litegraph-compat.d.ts` | 兼容差异矩阵（声明侧） | 与 `litegraph-compat.ts` 对应的 d.ts 版本，保证类型层面对同一批差异有明确声明。 |
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
2. `core/litegraph.constants.ts`、`core/litegraph.registry.ts`、`core/litegraph.runtime.ts`
3. Graph 链：`models/LGraph.*`
4. Node 链：`models/LGraphNode.*`
5. Canvas 链：`canvas/LGraphCanvas.*`
6. `ui/ContextMenu.ts`
7. `compat/*` 与 `types/litegraph-compat.ts`

## 现状备注

- 目录里的 `TODO: Import ... from its future module` 注释已经完成清理；当前阶段的重点不再是物理拆分，而是继续收敛 `host` 注入边界与模块间的最小依赖面。
- 兼容层文件不是“临时脚手架”这么简单，它们现在就是迁移工程对外稳定性的关键组成部分。
- 如果后续继续推进重构，这份目录最需要优先收敛的是：
  - `models/`、`canvas/` 里的 host 注入接口
  - `types/litegraph-compat.ts` 对应的差异矩阵项
  - `index.ts` 中 assembly 逻辑对全局环境的桥接代码
