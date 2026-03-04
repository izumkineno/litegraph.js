# Migration_Plan_and_Progress

## 摘要

本文件是 `src/litegraph.js`（约 14k 行，IIFE + Prototype）与 `src/litegraph.d.ts` 的 TypeScript 迁移蓝图与进度追踪器。
拆分依据来自 `guides/CORE_INDEX.md` 的结构分层与 `guides/rendering-and-operations.md` 的运行时调用链，目标是在**不修改原 `.js` / `.d.ts`** 的前提下，按模块增量迁移到独立 `.ts` 文件。

## 迁移纪律（锁定）

- [X] 原始文件只读：不修改 `src/litegraph.js` 与 `src/litegraph.d.ts`。
- [X] 增量迁移：每次只迁移一个明确模块或子模块。
- [X] 隔离产出：所有新增代码放入新目录 `src/ts-migration/`。
- [X] 行为优先：先保证运行时行为一致，再做类型收紧和结构优化。

## 分析基线

- 源码主文件：`src/litegraph.js`（构造函数：`LGraph`、`LLink`、`LGraphNode`、`LGraphGroup`、`DragAndScale`、`LGraphCanvas`、`ContextMenu`、`CurveEditor`）。
- 类型声明：`src/litegraph.d.ts`（核心类型、接口、类声明与 `LiteGraph` 命名空间契约）。
- 指南参考：
  - `guides/CORE_INDEX.md`（模块边界、方法索引、行号地图）
  - `guides/rendering-and-operations.md`（渲染双层管线、执行循环、交互时序）
  - `guides/README.md`（节点注册混入机制、核心类关系）

## 模块划分（目标 TS 结构）

| 模块ID | 逻辑模块                                 | 来源（JS / d.ts）                                                                             | 目标产物（新文件）                                                                                                                          |
| ------ | ---------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| M00    | 类型基础层                               | `Vector2/Vector4`、`INode*`、`IWidget*`、`IContextMenu*`、序列化类型                  | `src/ts-migration/types/core-types.ts`、`src/ts-migration/types/serialization.ts`                                                       |
| M01    | LiteGraph 核心命名空间（常量/枚举/配置） | `LiteGraph` 对象常量区与全局配置区                                                          | `src/ts-migration/core/litegraph.constants.ts`                                                                                            |
| M02    | LiteGraph 注册与工厂                     | `registerNodeType`、`createNode`、`getNodeType*`、`addNodeMethod`                     | `src/ts-migration/core/litegraph.registry.ts`                                                                                             |
| M03    | LiteGraph 运行时辅助                     | `isValidConnection`、`fetchFile`、`cloneObject`、`uuidv4`、`registerSearchboxExtra` | `src/ts-migration/core/litegraph.runtime.ts`                                                                                              |
| M04    | 通用工具函数组                           | `compareObjects`、`distance`、`colorToString`、包围盒/颜色转换、`clamp`               | `src/ts-migration/utils/math-geometry.ts`、`src/ts-migration/utils/color.ts`                                                            |
| M05    | 环境兼容辅助                             | `getTime` 适配、`pointerListenerAdd/Remove`、`getParameterNames`                        | `src/ts-migration/compat/time-source.ts`、`src/ts-migration/compat/pointer-events.ts`、`src/ts-migration/utils/function-signature.ts` |
| M06    | LLink 连线模型                           | `function LLink` + `LLink.prototype.*`                                                    | `src/ts-migration/models/LLink.ts`                                                                                                        |
| M07    | LGraph 图运行时容器                      | `function LGraph` + `LGraph.prototype.*`（生命周期/执行/I/O/序列化）                      | `src/ts-migration/models/LGraph.ts` + 分片文件                                                                                            |
| M08    | LGraphNode 节点基类                      | `function LGraphNode` + `LGraphNode.prototype.*`                                          | `src/ts-migration/models/LGraphNode.ts` + 分片文件                                                                                        |
| M09    | LGraphGroup 分组模型                     | `function LGraphGroup` + `LGraphGroup.prototype.*` + 复用方法                             | `src/ts-migration/models/LGraphGroup.ts`                                                                                                  |
| M10    | DragAndScale 视图变换                    | `function DragAndScale` + `DragAndScale.prototype.*`                                      | `src/ts-migration/canvas/DragAndScale.ts`                                                                                                 |
| M11    | LGraphCanvas 静态 API                    | `LGraphCanvas.*` 静态方法与静态资源                                                         | `src/ts-migration/canvas/LGraphCanvas.static.ts`                                                                                          |
| M12    | LGraphCanvas 实例：生命周期与输入        | `LGraphCanvas.prototype` 生命周期、事件绑定、鼠标键盘拖放、选择剪贴板                       | `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts`、`src/ts-migration/canvas/LGraphCanvas.input.ts`                                    |
| M13    | LGraphCanvas 实例：渲染管线              | `draw*`、`renderLink`、`drawNodeWidgets`、`processNodeWidgets` 等                     | `src/ts-migration/canvas/LGraphCanvas.render.ts`                                                                                          |
| M14    | LGraphCanvas 实例：菜单/面板/搜索/子图   | `showSearchBox`、`createDialog`、`processContextMenu` 等                                | `src/ts-migration/canvas/LGraphCanvas.menu-panel.ts`                                                                                      |
| M15    | ContextMenu UI 组件                      | `function ContextMenu` + `ContextMenu.prototype.*` + 静态方法                             | `src/ts-migration/ui/ContextMenu.ts`                                                                                                      |
| M16    | CurveEditor UI 组件                      | `function CurveEditor` + `CurveEditor.prototype.*`                                        | `src/ts-migration/ui/CurveEditor.ts`                                                                                                      |
| M17    | 兼容导出桥接层                           | IIFE 全局挂载 + CommonJS 导出                                                                 | `src/ts-migration/compat/global-bridge.ts`、`src/ts-migration/compat/cjs-exports.ts`                                                    |
| M18    | 入口聚合层                               | 对外统一导出                                                                                  | `src/ts-migration/index.ts`                                                                                                               |

## 依赖关系与转换顺序

1. `M00 -> M01/M02/M03/M04/M05`
2. `M01/M02/M03 + M00 -> M06/M08`
3. `M06/M08 + M00 -> M07`
4. `M08 + M11(静态色板) -> M09`
5. `M00/M04/M05 -> M10`
6. `M07/M08/M09/M10/M15 + M11 -> M12/M13/M14`
7. `M04/M05 -> M15/M16`
8. `M01..M16 -> M17 -> M18`

默认先后（建议执行顺序）：`M00 -> M01~M05 -> M06 -> M08 -> M07 -> M10 -> M15 -> M11 -> M12~M14 -> M09 -> M16 -> M17 -> M18`。
说明：`M09 (LGraphGroup)` 在 JS 中引用 `LGraphCanvas.node_colors`，迁移时采用“颜色提供器注入/延迟绑定”打破循环依赖。

## 公共 API / 接口 / 类型变更策略（仅迁移层）

- 对外名称保持兼容：`LiteGraph`、`LGraph`、`LLink`、`LGraphNode`、`LGraphGroup`、`DragAndScale`、`LGraphCanvas`、`ContextMenu`。
- 不改原始 `src/litegraph.d.ts`；新增迁移补充声明：`src/ts-migration/types/litegraph-compat.d.ts`。
- 已识别的契约差异在迁移层做别名或补充声明，不改旧声明文件：
  - `onResizeNode`（声明）与 `onMenuResizeNode`（实现）命名差异。
  - `onMenuNodeToSubgraph`（实现存在，声明缺失）。
  - `processNodeDeselected` / `drawSlotGraphic` / `touchHandler`（声明与实现存在差异，需建立兼容策略）。
  - `GRID_SHAPE`（实现）与 `SQUARE_SHAPE`（声明）常量命名差异（同值 `6`）。
  - `SerializedLLink` 元组字段顺序差异（声明与实现不一致，需双格式兼容）。
  - `SerializedLGraphGroup` 的 `font`（声明）与 `font_size`（实现）字段差异。
  - `ContextMenu.closeAllContextMenus`（声明）与 `LiteGraph.closeAllContextMenus`（实现）归属差异。
  - `LGraph.onNodeAdded` 在声明中存在、在实现中仅作为可选回调调用点存在。
  - `LGraphCanvas` 静态 API 缺口：`getBoundaryNodes`、`alignNodes`、`onNodeAlign`、`onGroupAlign`、`getPropertyPrintableValue`。
- 先行为一致，再逐步收紧类型（`any` -> 明确泛型/联合类型）。

## Task Checklist（核心）

### Phase A：基础与契约冻结

- [x] **Task 01: 迁移目录与入口骨架** — 来源：迁移约束与模块划分；目标产物：`src/ts-migration/index.ts`、目录结构占位。
- [x] **Task 02: 核心类型契约提取** — 来源：`litegraph.d.ts` 的 `Vector*`、`INode*`、`IWidget*`、`IContextMenu*`；目标产物：`types/core-types.ts`。
- [x] **Task 03: 序列化契约提取** — 来源：`serializedLGraph`、`SerializedLLink`、`SerializedLGraphNode`、`SerializedLGraphGroup`；目标产物：`types/serialization.ts`。
- [x] **Task 04: LiteGraph 常量与枚举迁移** — 来源：`src/litegraph.js` LiteGraph 常量区；目标产物：`core/litegraph.constants.ts`。
- [x] **Task 05: LiteGraph 注册与工厂 API 迁移** — 来源：`registerNodeType`、`unregisterNodeType`、`createNode`、`getNodeType*`、`addNodeMethod`；目标产物：`core/litegraph.registry.ts`。
- [x] **Task 06: LiteGraph 运行辅助 API 迁移** — 来源：`registerNodeAndSlotType`、`buildNodeClassFromObject`、`wrapFunctionAsNode`、`isValidConnection`、`fetchFile` 等；目标产物：`core/litegraph.runtime.ts`。
- [x] **Task 07: 通用函数组迁移** — 来源：`compareObjects`、`distance`、`colorToString`、包围盒、`hex2num/num2hex`、`clamp`；目标产物：`utils/math-geometry.ts`、`utils/color.ts`、`utils/clamp.ts`。
- [x] **Task 08: 运行时兼容辅助迁移** — 来源：`getTime` 适配、`pointerListenerAdd/Remove`、`getParameterNames`；目标产物：`compat/time-source.ts`、`compat/pointer-events.ts`、`utils/function-signature.ts`。

### Phase B：数据模型与执行内核

- [x] **Task 09: LLink 类迁移** — 来源：`function LLink` 与 `LLink.prototype.configure/serialize`；目标产物：`models/LLink.ts`。
- [x] **Task 10: LGraph 生命周期迁移** — 来源：`LGraph` 构造、`clear/start/stop/getTime*`；目标产物：`models/LGraph.lifecycle.ts`。
- [x] **Task 11: LGraph 执行调度迁移** — 来源：`runStep/updateExecutionOrder/computeExecutionOrder/getAncestors/arrange`；目标产物：`models/LGraph.execution.ts`。
- [x] **Task 12: LGraph 结构管理迁移** — 来源：`add/remove/getNodeById/find*`、`getNodeOnPos/getGroupOnPos`；目标产物：`models/LGraph.structure.ts`。
- [x] **Task 13: LGraph 图级 I/O 与事件迁移** — 来源：`addInput/addOutput/triggerInput/sendEventToAllNodes/connectionChange`；目标产物：`models/LGraph.io-events.ts`。
- [x] **Task 14: LGraph 序列化与加载迁移** — 来源：`serialize/configure/load/removeLink/onNodeTrace`；目标产物：`models/LGraph.persistence.ts`。
- [x] **Task 15: LGraphNode 构造与状态层迁移** — 来源：`_ctor/configure/serialize/clone/toString/getTitle/setProperty`；目标产物：`models/LGraphNode.state.ts`。
- [x] **Task 16: LGraphNode 数据通道与执行层迁移** — 来源：`setOutputData/getInputData/doExecute/actionDo/trigger/triggerSlot/clearTriggeredSlot`；目标产物：`models/LGraphNode.execution.ts`。
- [x] **Task 17: LGraphNode 端口与 Widget 层迁移** — 来源：`addInput/addOutput/addWidget/addCustomWidget/computeSize/getPropertyInfo`；目标产物：`models/LGraphNode.ports-widgets.ts`。
- [ ] **Task 18: LGraphNode 连接与几何层迁移** — 来源：`find*Slot*`、`connect*`、`disconnect*`、`getConnectionPos/getBounding/isPointInside`；目标产物：`models/LGraphNode.connect-geometry.ts`。
- [ ] **Task 19: LGraphNode 画布协作层迁移** — 来源：`alignToGrid/trace/setDirtyCanvas/loadImage/executeAction/captureInput/collapse/pin/localToScreen`；目标产物：`models/LGraphNode.canvas-collab.ts`。
- [ ] **Task 20: LGraphGroup 类迁移** — 来源：`_ctor/configure/serialize/move/recomputeInsideNodes` + 复用 `isPointInside/setDirtyCanvas`；目标产物：`models/LGraphGroup.ts`。
- [ ] **Task 21: DragAndScale 类迁移** — 来源：`bindEvents/computeVisibleArea/onMouse/changeScale/reset`；目标产物：`canvas/DragAndScale.ts`。

### Phase C：Canvas、UI 与兼容桥

- [ ] **Task 22: LGraphCanvas 静态区迁移** — 来源：`LGraphCanvas.*` 静态方法与静态字段（含菜单命令处理器）；需显式覆盖 `getBoundaryNodes/alignNodes/onNodeAlign/onGroupAlign/getPropertyPrintableValue/onMenuResizeNode/onMenuNodeToSubgraph`；目标产物：`canvas/LGraphCanvas.static.ts`。
- [ ] **Task 23: LGraphCanvas 生命周期与事件绑定迁移** — 来源：构造、`clear/setGraph/openSubgraph/closeSubgraph/setCanvas/bindEvents/unbindEvents`；目标产物：`canvas/LGraphCanvas.lifecycle.ts`。
- [ ] **Task 24: LGraphCanvas 输入交互迁移** — 来源：`processMouse*`、`processKey`、`copy/paste`、`processDrop`、选择与视图控制；目标产物：`canvas/LGraphCanvas.input.ts`。
- [ ] **Task 25: LGraphCanvas 渲染管线迁移** — 来源：`draw/drawFrontCanvas/drawBackCanvas/drawNode/drawConnections/renderLink/drawNodeWidgets/processNodeWidgets`；目标产物：`canvas/LGraphCanvas.render.ts`。
- [ ] **Task 26: LGraphCanvas 菜单/面板/搜索迁移** — 来源：`showLinkMenu/showConnectionMenu/showSearchBox/createDialog/createPanel/processContextMenu` 等；目标产物：`canvas/LGraphCanvas.menu-panel.ts`。
- [ ] **Task 27: ContextMenu 组件迁移** — 来源：`ContextMenu` 构造、实例方法、静态 `trigger/isCursorOverElement`；目标产物：`ui/ContextMenu.ts`。
- [ ] **Task 28: CurveEditor 组件迁移** — 来源：`sampleCurve/draw/onMouse*/getCloserPoint`；目标产物：`ui/CurveEditor.ts`。
- [ ] **Task 29: 全局与 CommonJS 兼容桥迁移** — 来源：IIFE 全局挂载与末尾 `exports.*`；目标产物：`compat/global-bridge.ts`、`compat/cjs-exports.ts`。
- [ ] **Task 30: API 差异对齐与兼容别名** — 来源：`d.ts` 与 JS 命名/存在性差异；需产出“差异矩阵 + 兼容映射”，覆盖常量、静态 API、序列化字段顺序与字段名冲突；目标产物：`types/litegraph-compat.d.ts`、兼容别名映射模块。
- [ ] **Task 31: 聚合导出与装配** — 来源：全部迁移模块；目标产物：`src/ts-migration/index.ts`。

### Phase D：验证与回归门禁

- [ ] **Task 32: 行为对齐测试（单元）** — 来源：核心方法行为；目标产物：`tests/migration-unit/*.test.ts`。
- [ ] **Task 33: 序列化回归测试（对比旧实现）** — 来源：`serialize/configure` 结果一致性；需覆盖 `SerializedLLink` 双输入顺序与 `SerializedLGraphGroup(font/font_size)` 双输入字段；目标产物：`tests/migration-parity/serialization.test.ts`。
- [ ] **Task 34: UI 关键链路回归（E2E）** — 来源：现有 Playwright `@core` 用例；需补充菜单对齐、子图转换、属性打印值路径；目标产物：`tests/playwright` 增补/复用用例与报告。
- [ ] **Task 35: 进度与风险更新** — 来源：每个阶段完成后；目标产物：更新本文件“进度快照/风险清单”。

### Phase E：契约冲突与兼容收敛（补充）

- [ ] **Task 36: JS 与 d.ts 契约差异矩阵落地** — 来源：`src/litegraph.js` 与 `src/litegraph.d.ts` 差异项；目标产物：`types/contract-diff-matrix.md`、`types/litegraph-compat.d.ts`。
- [ ] **Task 37: 常量别名兼容层** — 来源：`GRID_SHAPE` vs `SQUARE_SHAPE`；目标产物：`core/litegraph.constants.compat.ts`。
- [ ] **Task 38: LLink 序列化兼容解析器** — 来源：`SerializedLLink` 顺序冲突；目标产物：`models/LLink.serialization.compat.ts`。
- [ ] **Task 39: LGraphGroup 序列化字段兼容** — 来源：`font` vs `font_size`；目标产物：`models/LGraphGroup.serialization.compat.ts`。
- [ ] **Task 40: ContextMenu/LiteGraph 菜单关闭 API 对齐** — 来源：`closeAllContextMenus` 归属差异；目标产物：`ui/context-menu-compat.ts`。
- [ ] **Task 41: LGraph hook 契约对齐** — 来源：`onNodeAdded` 声明/实现差异；目标产物：`models/LGraph.hooks.ts`。
- [ ] **Task 42: LGraphCanvas 静态 API 补全** — 来源：静态方法声明缺口；目标产物：`canvas/LGraphCanvas.static.compat.ts`。
- [ ] **Task 43: 契约快照测试** — 来源：Phase E 全部兼容点；目标产物：`tests/migration-parity/contracts.test.ts`。
- [ ] **Task 44: 兼容模式回归 E2E** — 来源：菜单、子图、对齐菜单、属性展示路径；目标产物：`tests/playwright/specs/migration-compat-guard.spec.cjs`。

## 测试场景与验收标准

1. **注册与节点创建**：`registerNodeType/createNode/getNodeType*` 行为与旧实现一致。
2. **图执行闭环**：`LGraph.start/runStep/stop` + `LGraphNode.doExecute/triggerSlot` 行为一致。
3. **连线协议**：`connect/disconnect/removeLink/isValidConnection` 与旧实现一致。
4. **序列化闭环**：`serialize -> configure` 后结构与关键字段一致（节点、连线、分组、属性）。
5. **画布交互闭环**：鼠标拖拽、缩放、选择、复制粘贴、搜索加点、上下文菜单动作有效。
6. **子图闭环**：`openSubgraph/closeSubgraph` 与子图面板联动一致。
7. **兼容导出**：全局与 CommonJS 名称可用且与旧入口一致。
8. **常量别名兼容**：`GRID_SHAPE` 与 `SQUARE_SHAPE` 同值可用。
9. **Link 双格式反序列化**：`SerializedLLink` 两种顺序均可正确解析。
10. **Group 双字段反序列化**：`font` 与 `font_size` 输入均可配置成功。
11. **菜单关闭双入口兼容**：`LiteGraph.closeAllContextMenus` 与 `ContextMenu.closeAllContextMenus` 行为一致。
12. **Canvas 静态能力完整**：补齐的静态 API 均可调用并通过类型检查。
13. **兼容模式不回归**：新增兼容守卫用例通过且不影响现有 `@core`。

验收门槛：

1. 迁移模块编译通过（TypeScript 无阻断错误）。
2. Parity 用例通过率 100%。
3. 现有 `@core` Playwright 不回归。
4. 对外 API 名称与旧版保持可兼容访问。
5. 契约冲突点（常量/序列化/静态 API）全部有测试守卫。

## 默认假设与已锁定决策

1. 新代码目录固定为 `src/ts-migration/`，不混入原 `src/`。
2. 迁移阶段不改构建产物入口；先完成行为对齐，再接入正式构建。
3. 采用“分片文件 + 聚合导出”管理超大类（尤其 `LGraphNode` 与 `LGraphCanvas`）。
4. 对 `LGraphGroup` 与 `LGraphCanvas.node_colors` 的循环依赖采用注入/延迟绑定解决。
5. `vec2` 等外部全局依赖在迁移层显式声明，不隐式依赖 window。
6. 原 `src/litegraph.d.ts` 保持不变，兼容差异通过新增补充声明解决。
7. 对声明与实现冲突项采用“兼容输入 + 规范输出”策略，优先保持运行时行为一致。

## 进度快照

- 当前阶段：`Phase B 执行中（Task 17 已完成）`
- 总任务数：`44`
- 已完成：`17`
- 进行中：`0`
- 待开始：`27`

## 进度日志（模板）

| 日期       | 阶段 | 完成任务 | 变更摘要                                   | 风险/阻塞                         | 下一步              |
| ---------- | ---- | -------- | ------------------------------------------ | --------------------------------- | ------------------- |
| 2026-03-03 | 规划 | 蓝图建立 | 完成模块拆分、依赖顺序、任务清单与验收标准 | d.ts 与实现存在命名差异，需兼容层 | 从 Task 01 开始执行 |
| 2026-03-03 | 执行 | Task 01 | 创建 `src/ts-migration/` 目录骨架与 `index.ts` 聚合入口占位 | 暂无；后续需从 `litegraph.d.ts` 精确抽取类型 | 执行 Task 02 |
| 2026-03-03 | 执行 | Task 02 | 提取 `Vector*`、`INode*`、`IWidget*`、`IContextMenu*` 到 `types/core-types.ts`，并保留相关注释与依赖 TODO | `Like` 占位类型需在后续模型迁移阶段替换为真实类型导入 | 执行 Task 03 |
| 2026-03-03 | 执行 | Task 03 | 提取 `serializedLGraph`、`SerializedLLink`、`SerializedLGraphNode`、`SerializedLGraphGroup` 到 `types/serialization.ts`，并保留 issue 注释与依赖 TODO | `SerializedLLink` 元组顺序存在实现差异，后续在兼容层任务处理 | 执行 Task 04 |
| 2026-03-03 | 执行 | Task 04 | 提取 LiteGraph 常量与枚举配置到 `core/litegraph.constants.ts`，保留配置注释与修饰键/触摸检测逻辑 | `GRID_SHAPE` 与旧声明 `SQUARE_SHAPE` 的兼容命名差异留待兼容层任务处理 | 执行 Task 05 |
| 2026-03-03 | 执行 | Task 05 | 提取注册与工厂 API 到 `core/litegraph.registry.ts`（`register/unregister/createNode/getNodeType*`、`addNodeMethod`），保留原 JSDoc 与行为分支 | 依赖 `LGraphNode` 真实类型与 `registerNodeAndSlotType` 的完整契约待后续任务收敛 | 执行 Task 06 |
| 2026-03-03 | 执行 | Task 06 | 提取运行辅助 API 到 `core/litegraph.runtime.ts`（`registerNodeAndSlotType/buildNodeClassFromObject/wrapFunctionAsNode/reloadNodes/cloneObject/uuidv4/isValidConnection/registerSearchboxExtra/fetchFile`） | `fetchFile` 在 `FileReader` 分支保留原返回行为（`void`），以及 DOM/浏览器依赖需在后续兼容层测试验证 | 执行 Task 07 |
| 2026-03-03 | 执行 | Task 07 | 提取通用函数组到 `utils/math-geometry.ts`、`utils/color.ts`、`utils/clamp.ts`，保留原算法与注释语义 | `isInsideBounding` 在源码与声明存在入参形态差异，已在迁移层做兼容分支，后续可在契约任务收敛 | 执行 Task 08 |
| 2026-03-03 | 执行 | Task 08 | 提取兼容辅助到 `compat/time-source.ts`、`compat/pointer-events.ts` 与 `utils/function-signature.ts`，保留时间源回退、触摸归一化与监听器注册行为 | Pointer 兼容分支依赖浏览器环境，需在后续 UI/E2E 阶段做跨输入模式回归 | 执行 Task 09 |
| 2026-03-03 | 执行 | Task 09 | 迁移 `LLink` 到 `models/LLink.ts`，实现 `configure/serialize` 并兼容声明元组与运行时元组顺序 | `SerializedLLink` 顺序冲突仍需在兼容专项任务中统一出口策略 | 执行 Task 10 |
| 2026-03-03 | 执行 | Task 10 | 迁移 `LGraph` 生命周期到 `models/LGraph.lifecycle.ts`（构造、`clear/start/stop/getTime*`），并保留原 JSDoc | `runStep/sendEventToAllNodes/change/sendActionToCanvas` 由后续任务实现，当前以占位方法维持可编译与增量落地 | 执行 Task 11 |
| 2026-03-03 | 执行 | Task 11 | 迁移 `LGraph` 执行调度到 `models/LGraph.execution.ts`（`runStep/updateExecutionOrder/computeExecutionOrder/getAncestors/arrange`）并保留原 JSDoc | 当前采用继承 `LGraph` 的增量结构，后续需在模型收敛阶段统一单一导出入口 | 执行 Task 12 |
| 2026-03-03 | 执行 | Task 12 | 迁移 `LGraph` 结构管理到 `models/LGraph.structure.ts`（`add/remove/getNodeById/find*/getNodeOnPos/getGroupOnPos`），并保留原 JSDoc 与 `beforeChange/afterChange` 注释语义 | `id` 在 UUID/数字双模式下依赖后续模型类型统一，`setDirtyCanvas` 仍为占位等待后续任务落地 | 执行 Task 13 |
| 2026-03-03 | 执行 | Task 13 | 迁移 `LGraph` 图级 I/O 与事件到 `models/LGraph.io-events.ts`（`sendEventToAllNodes/onAction/trigger/addInput/addOutput/triggerInput/connectionChange` 及相关变更通知）并保留原 JSDoc 与变更前后钩子语义 | 事件分发依赖 `LiteGraph.Subgraph/GraphInput` 运行时注入，后续需在聚合导出阶段统一宿主绑定 | 执行 Task 14 |
| 2026-03-03 | 执行 | Task 14 | 迁移 `LGraph` 序列化与加载到 `models/LGraph.persistence.ts`（`removeLink/serialize/configure/load/onNodeTrace`），保留链路修复、容错反序列化与 `onSerialize/onConfigure` 钩子行为 | `load` 依赖浏览器 `FileReader/XMLHttpRequest`，以及缺失节点类型时的降级构造依赖后续 `LGraphNode` 模块完成后再统一 | 执行 Task 15 |
| 2026-03-04 | 执行 | Task 15 | 迁移 `LGraphNode` 构造与状态层到 `models/LGraphNode.state.ts`（`_ctor/configure/serialize/clone/toString/getTitle/setProperty`），保留属性回调、连接回调与序列化钩子语义 | 当前通过 `LiteGraph host` 注入 `createNode/cloneObject` 等运行时能力，后续在入口装配阶段需统一绑定真实宿主 | 执行 Task 16 |
| 2026-03-04 | 执行 | Task 16 | 迁移 `LGraphNode` 数据通道与执行层到 `models/LGraphNode.execution.ts`（`setOutputData/getInputData/doExecute/actionDo/trigger/triggerSlot/clearTriggeredSlot`，并补齐同段 `setOutputDataType/getInputDataType/getInputDataByName/executePendingActions`） | 触发链仍依赖 `findInputSlot` 与完整连接/端口实现，待后续 Task 17-18 收敛 | 执行 Task 17 |
| 2026-03-04 | 执行 | Task 17 | 迁移 `LGraphNode` 端口与 Widget 层到 `models/LGraphNode.ports-widgets.ts`（`addInput/addOutput/addWidget/addCustomWidget/computeSize/getPropertyInfo`，并补齐 `addInputs/addOutputs/setSize`） | `removeInput/removeOutput` 与断连链路依赖后续连接层任务统一收敛，`setDirtyCanvas` 仍为占位待 Task 19 落地 | 执行 Task 18 |
