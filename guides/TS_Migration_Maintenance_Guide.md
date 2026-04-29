# TS Migration 维护指南

本文面向 `src/ts-migration/` 的开发者与维护者，说明当前 TypeScript 迁移层的结构、阅读路径、关键兼容边界和修改时应遵守的验证方式。它不是迁移计划，也不记录一次性执行进度。

## 1. 定位

`src/ts-migration/` 是 LiteGraph 核心运行时的 TypeScript 分层实现。它的目标是把旧版单文件运行时拆成可维护的模块，同时维持这些外部契约：

- `LiteGraph` 命名空间与全局挂载行为。
- `LGraph` / `LGraphNode` / `LGraphCanvas` / `ContextMenu` 等核心构造器。
- 旧图 JSON 的序列化与反序列化兼容。
- CommonJS 和浏览器全局使用方式。

## 2. 推荐阅读顺序

1. [`src/ts-migration/index.ts`](../src/ts-migration/index.ts)：总装配入口。
2. [`core/litegraph.namespace.ts`](../src/ts-migration/core/litegraph.namespace.ts)：构建 `LiteGraph` 命名空间和 class host。
3. [`contracts/`](../src/ts-migration/contracts/)：跨层最小接口。
4. [`models/LGraph.*`](../src/ts-migration/models/)：图生命周期、执行、结构、IO、持久化链。
5. [`models/LGraphNode.*`](../src/ts-migration/models/)：节点状态、执行、端口/widget、连接几何、画布协作链。
6. [`canvas/LGraphCanvas.*`](../src/ts-migration/canvas/)：画布静态能力、生命周期、输入、渲染、菜单面板链。
7. [`services/`](../src/ts-migration/services/) 与 [`ui/`](../src/ts-migration/ui/)：低频 UI、菜单、面板和独立组件。
8. [`compat/`](../src/ts-migration/compat/) 与 [`types/litegraph-compat.ts`](../src/ts-migration/types/litegraph-compat.ts)：兼容桥和差异矩阵。

更细的文件职责可参考 [`src/ts-migration/README.md`](../src/ts-migration/README.md)。

## 3. 分层模型

### Graph 链

`LGraph.lifecycle -> LGraph.execution -> LGraph.structure -> LGraph.io-events -> LGraph.persistence`

- 生命周期层只负责基础状态、清理、运行/停止、canvas attach。
- 执行层负责 `runStep`、执行顺序、拓扑排序、时间统计。
- 结构层负责节点和分组的增删查。
- IO/events 层负责图级输入输出与事件广播。
- persistence 层负责保存/恢复和旧数据容错。

### Node 链

`LGraphNode.state -> LGraphNode.execution -> LGraphNode.ports-widgets -> LGraphNode.connect-geometry -> LGraphNode.canvas-collab`

- state 是节点字段和基础序列化的底座。
- execution 处理 `onExecute`、action、trigger 和延迟 action。
- ports-widgets 管理输入输出端口、属性和 widget。
- connect-geometry 处理连线、slot 位置和命中几何。
- canvas-collab 放置必须与画布协作的能力，例如 dirty canvas、捕获输入和屏幕坐标转换。

### Canvas 链

`LGraphCanvas.static -> LGraphCanvas.lifecycle -> LGraphCanvas.input -> LGraphCanvas.render -> LGraphCanvas.menu-panel`

- static 定义静态入口和基础字段。
- lifecycle 处理构造、resize、事件绑定、背景和运行模式。
- input 处理鼠标、触摸、键盘、选择、拖拽、连线。
- render 负责背景、group、node、link、widget 和覆盖层绘制。
- menu-panel 应保持薄调度层；DOM 构造和菜单流程应进入 `services/`。

## 4. 兼容边界

维护 `ts-migration` 时，不应只看类型是否通过，还要确认旧运行时契约是否仍成立：

- 序列化：`LLink`、`LGraphGroup`、graph/node JSON 字段顺序和默认值。
- 静态 API：`LGraphCanvas` 的菜单、resize、active canvas、node colors 等历史入口。
- 全局桥：浏览器全局对象和 CJS exports。
- 指针事件：mouse / touch / pointer 的事件名、坐标和监听器释放。
- hook 行为：如 `onNodeAdded` 等历史钩子的触发时机。

相关说明：[`types/contract-diff-matrix.md`](../src/ts-migration/types/contract-diff-matrix.md)。

## 5. 修改原则

- 不要让 `models` 重新依赖完整 `canvas` / `ui` 实现；需要跨层能力时先扩展 `contracts/` 的最小 port。
- 不要把 `index.ts` 重新变成运行时实现文件；它应保持装配入口。
- 新增浮层、菜单、面板时优先复用 `floating-ui-service.ts`、`dialog-factory.ts`、`panel-factory.ts`。
- 新增兼容策略时，先检查 `compat/` 和 `types/litegraph-compat.ts`，避免多份真相。
- 修改热路径（input/render/execution）时，避免在每帧或每次鼠标事件中新增对象合并、DOM 查询或动态能力探测。

## 6. 验证命令

```bash
bun run typecheck
bun run build:ts-migration
bun run test
```

当前 `bun run test` 仍依赖旧 `src/litegraph` 入口；如果该入口在工作区中缺失，旧运行时 parity 测试会失败。详见 [TS Migration 问题清单](./TS_Migration_Issues.md)。
