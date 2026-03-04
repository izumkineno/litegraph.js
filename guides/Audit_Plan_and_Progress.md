# Audit_Plan_and_Progress

## 目标与范围

本文件用于审计以下三类输入之间的一致性，目标是最大化还原 `src/litegraph.js` 逻辑并与 `src/litegraph.d.ts` 契约对齐：

1. 原始实现：`src/litegraph.js`（IIFE + Prototype）
2. 原始类型：`src/litegraph.d.ts`
3. 迁移实现：`src/ts-migration/**/*.ts` 与 `src/ts-migration/types/litegraph-compat.d.ts`

审计结论标准：

- 逻辑路径不丢失（方法、分支、回调、状态变更链）
- 公开 API 契约不破坏（`d.ts` 对齐 + 兼容层说明完整）
- UI 交互与序列化行为可回归验证

---

## 审计维度（必须逐项核对）

1. **构造与原型完整性**
   - 是否覆盖原 JS 构造函数及 `prototype.*` 方法。
   - 是否存在遗漏方法、遗漏静态 API、遗漏字段初始化。
2. **属性与默认值一致性**
   - 默认值、可选值、空值语义（`null/undefined/false/0`）是否一致。
   - 关键运行时状态字段是否有丢失或重命名。
3. **条件分支完整性**
   - 原始 `if/else/switch/早返回` 分支是否完整迁移。
   - 是否有被截断逻辑、被简化后行为改变、异常路径遗漏。
4. **回调与钩子语义**
   - `on*` 回调、事件触发时机、调用参数与调用顺序是否一致。
   - 图级/节点级/画布级回调链是否断裂。
5. **连接与执行链语义**
   - `connect/disconnect/trigger/actionDo/doExecute` 等链路是否一致。
   - 执行模式（Always/On Event/Never/On Trigger）是否一致。
6. **序列化兼容性**
   - `serialize/configure/load` 字段与结构是否一致。
   - 兼容项（`SerializedLLink` 顺序、`font/font_size`）是否双向可用。
7. **Canvas 交互一致性**
   - 鼠标/键盘/拖拽/缩放/选择/复制粘贴/搜索框/上下文菜单行为是否一致。
   - 子图进入/返回、面板/对话框关闭策略是否一致。
8. **渲染一致性与鲁棒性**
   - `draw*` 管线、可见节点计算、连线渲染、widget 渲染是否一致。
   - 非法输入（颜色、节点缺失、空链接）是否具备等价降级能力。
9. **类型契约与 d.ts 对齐**
   - 参数、返回值、可选性、联合类型是否满足 `src/litegraph.d.ts`。
   - 不一致项是否有 `compat` 显式记录与别名映射。
10. **JSDoc 与可维护性信息保留**
    - 关键 API 的 JSDoc 是否保留核心语义（用途、参数、副作用）。
    - 注释是否反映真实行为，是否存在误导性注释。
11. **兼容桥接与导出语义**
    - 全局挂载、CommonJS 导出、兼容别名注入是否与原入口一致。
12. **测试可追溯性**
    - 每个模块审计项需有证据：源码位置 + 对应测试（单元/Parity/E2E）。

---

## 审计执行规范

每个审计任务至少输出以下证据：

1. 原 JS 位置（函数/原型路径）
2. 原 d.ts 对应声明（类/接口/成员）
3. TS 对应文件与方法
4. 判定结果：`Pass / Partial / Fail`
5. 备注：差异说明与修复建议（如有）

状态约定：

- `[ ]` 未开始
- `[-]` 审计中
- `[x]` 已完成（有证据）

Git 提交规则（强制）：

1. 每次完成一个 Audit Task 的验证后，若发现缺失并已修复，必须立即提交一次 git。
2. 提交必须只包含该 Audit Task 直接相关的文件，不混入无关改动。
3. 建议提交信息格式：`fix(audit-task-XX): <缺失点/修复点简述>`。
4. 若该 Task 审计结果为“完美匹配（无代码修改）”，则不强制提交。

---

## Task Checklist（审计任务列表）

### A. 入口与类型层

- [x] **Audit Task 01: `src/ts-migration/index.ts`**
  - 对应原 JS：IIFE 入口装配、全局导出与 `exports.*`。
  - 对应原 d.ts：全局 `LiteGraph` API 聚合导出契约。

- [x] **Audit Task 02: `src/ts-migration/types/core-types.ts`**
  - 对应原 JS：核心结构约定（节点、槽、widget、菜单）在运行时使用路径。
  - 对应原 d.ts：`Vector*`、`INode*`、`IWidget*`、`IContextMenu*`。

- [x] **Audit Task 03: `src/ts-migration/types/serialization.ts`**
  - 对应原 JS：`serialize/configure` 数据结构。
  - 对应原 d.ts：`SerializedLLink/SerializedLGraphNode/SerializedLGraphGroup`。

- [x] **Audit Task 04: `src/ts-migration/types/litegraph-compat.ts`**
  - 对应原 JS：实现与声明差异兼容映射点。
  - 对应原 d.ts：差异 API 的类型对齐策略。

- [x] **Audit Task 05: `src/ts-migration/types/litegraph-compat.d.ts`**
  - 对应原 JS：兼容补丁可见 API。
  - 对应原 d.ts：补充声明是否无冲突、无破坏。

### B. LiteGraph 核心模块

- [x] **Audit Task 06: `src/ts-migration/core/litegraph.constants.ts`**
  - 对应原 JS：LiteGraph 常量区、枚举、默认配置。
  - 对应原 d.ts：常量声明、枚举值约束。

- [x] **Audit Task 07: `src/ts-migration/core/litegraph.constants.compat.ts`**
  - 对应原 JS：`GRID_SHAPE` 等历史常量语义。
  - 对应原 d.ts：`SQUARE_SHAPE` 等命名差异兼容。

- [x] **Audit Task 08: `src/ts-migration/core/litegraph.registry.ts`**
  - 对应原 JS：`registerNodeType/unregisterNodeType/createNode/getNodeType*`。
  - 对应原 d.ts：LiteGraph 工厂 API 与节点注册契约。

- [x] **Audit Task 09: `src/ts-migration/core/litegraph.runtime.ts`**
  - 对应原 JS：`isValidConnection/fetchFile/cloneObject/uuidv4/registerSearchboxExtra` 等。
  - 对应原 d.ts：运行时辅助 API 类型契约。

### C. 通用工具与环境兼容

- [x] **Audit Task 10: `src/ts-migration/utils/math-geometry.ts`**
  - 对应原 JS：`distance/compareObjects/isInside* / growBounding`。
  - 对应原 d.ts：相关工具函数签名。

- [x] **Audit Task 11: `src/ts-migration/utils/color.ts`**
  - 对应原 JS：`colorToString/hex2num/num2hex`。
  - 对应原 d.ts：颜色工具类型。

- [x] **Audit Task 12: `src/ts-migration/utils/clamp.ts`**
  - 对应原 JS：`clamp` 实现。
  - 对应原 d.ts：数学工具函数契约。

- [x] **Audit Task 13: `src/ts-migration/utils/function-signature.ts`**
  - 对应原 JS：`getParameterNames`。
  - 对应原 d.ts：函数签名工具契约。

- [x] **Audit Task 14: `src/ts-migration/compat/time-source.ts`**
  - 对应原 JS：`getTime` 兼容策略。
  - 对应原 d.ts：时间源函数契约。

- [x] **Audit Task 15: `src/ts-migration/compat/pointer-events.ts`**
  - 对应原 JS：`pointerListenerAdd/Remove` 与 pointer/touch 映射。
  - 对应原 d.ts：指针事件兼容 API 类型。

- [x] **Audit Task 16: `src/ts-migration/compat/global-bridge.ts`**
  - 对应原 JS：IIFE 全局桥接。
  - 对应原 d.ts：全局对象可见成员。

- [x] **Audit Task 17: `src/ts-migration/compat/cjs-exports.ts`**
  - 对应原 JS：CommonJS 导出段落。
  - 对应原 d.ts：模块导出命名一致性。

### D. 数据模型：LLink / LGraph / LGraphNode / LGraphGroup

- [x] **Audit Task 18: `src/ts-migration/models/LLink.ts`**
  - 对应原 JS：`function LLink` + `LLink.prototype.configure/serialize`。
  - 对应原 d.ts：`LLink` 类定义。

- [x] **Audit Task 19: `src/ts-migration/models/LLink.serialization.compat.ts`**
  - 对应原 JS：link 序列化历史顺序兼容。
  - 对应原 d.ts：`SerializedLLink` 顺序兼容语义。

- [x] **Audit Task 20: `src/ts-migration/models/LGraph.lifecycle.ts`**
  - 对应原 JS：`function LGraph` + `clear/start/stop/getTime*`。
  - 对应原 d.ts：`LGraph` 生命周期成员。

- [x] **Audit Task 21: `src/ts-migration/models/LGraph.execution.ts`**
  - 对应原 JS：`runStep/updateExecutionOrder/computeExecutionOrder/getAncestors/arrange`。
  - 对应原 d.ts：图执行调度相关成员。

- [x] **Audit Task 22: `src/ts-migration/models/LGraph.structure.ts`**
  - 对应原 JS：`add/remove/getNodeById/find*/getNodeOnPos/getGroupOnPos`。
  - 对应原 d.ts：图结构管理 API。

- [x] **Audit Task 23: `src/ts-migration/models/LGraph.io-events.ts`**
  - 对应原 JS：`addInput/addOutput/triggerInput/sendEventToAllNodes/connectionChange`。
  - 对应原 d.ts：图级 I/O 与事件接口。

- [x] **Audit Task 24: `src/ts-migration/models/LGraph.persistence.ts`**
  - 对应原 JS：`serialize/configure/load/removeLink/onNodeTrace`。
  - 对应原 d.ts：序列化/反序列化契约。

- [x] **Audit Task 25: `src/ts-migration/models/LGraph.hooks.ts`**
  - 对应原 JS：`onNodeAdded` 回调触发点。
  - 对应原 d.ts：`LGraph` hook 声明一致性。

- [x] **Audit Task 26: `src/ts-migration/models/LGraphNode.state.ts`**
  - 对应原 JS：`function LGraphNode` + `_ctor/configure/serialize/clone/setProperty`。
  - 对应原 d.ts：`LGraphNode` 基础状态与属性 API。

- [x] **Audit Task 27: `src/ts-migration/models/LGraphNode.execution.ts`**
  - 对应原 JS：`setOutputData/getInputData/doExecute/actionDo/trigger/triggerSlot`。
  - 对应原 d.ts：节点执行相关 API。

- [x] **Audit Task 28: `src/ts-migration/models/LGraphNode.ports-widgets.ts`**
  - 对应原 JS：`addInput/addOutput/addWidget/computeSize/getPropertyInfo`。
  - 对应原 d.ts：端口与 widget 相关定义。

- [x] **Audit Task 29: `src/ts-migration/models/LGraphNode.connect-geometry.ts`**
  - 对应原 JS：`find*Slot* / connect* / disconnect* / getConnectionPos / getBounding / isPointInside`。
  - 对应原 d.ts：连接与几何 API。

- [x] **Audit Task 30: `src/ts-migration/models/LGraphNode.canvas-collab.ts`**
  - 对应原 JS：`alignToGrid/trace/setDirtyCanvas/loadImage/collapse/pin/localToScreen`。
  - 对应原 d.ts：画布协作行为契约。

- [x] **Audit Task 31: `src/ts-migration/models/LGraphGroup.ts`**
  - 对应原 JS：`function LGraphGroup` + `configure/serialize/move/recomputeInsideNodes`。
  - 对应原 d.ts：`LGraphGroup` 声明。

- [x] **Audit Task 32: `src/ts-migration/models/LGraphGroup.serialization.compat.ts`**
  - 对应原 JS：`font_size` 运行时字段。
  - 对应原 d.ts：`font` 字段声明兼容。

### E. 画布层：DragAndScale / LGraphCanvas

- [x] **Audit Task 33: `src/ts-migration/canvas/DragAndScale.ts`**
  - 对应原 JS：`function DragAndScale` + 缩放平移换算链路。
  - 对应原 d.ts：`DragAndScale` 类声明。

- [x] **Audit Task 34: `src/ts-migration/canvas/LGraphCanvas.static.ts`**
  - 对应原 JS：`LGraphCanvas.*` 静态方法与静态字段。
  - 对应原 d.ts：`LGraphCanvas` 静态 API。

- [x] **Audit Task 35: `src/ts-migration/canvas/LGraphCanvas.static.compat.ts`**
  - 对应原 JS：静态 API 历史命名差异与缺口补齐策略。
  - 对应原 d.ts：静态兼容别名与补丁类型。

- [x] **Audit Task 36: `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts`**
  - 对应原 JS：构造、`setGraph/openSubgraph/closeSubgraph/bindEvents/unbindEvents`。
  - 对应原 d.ts：生命周期与绑定 API。

- [ ] **Audit Task 37: `src/ts-migration/canvas/LGraphCanvas.input.ts`**
  - 对应原 JS：`processMouse* / processKey / copy/paste / processDrop`。
  - 对应原 d.ts：输入交互 API。

- [ ] **Audit Task 38: `src/ts-migration/canvas/LGraphCanvas.render.ts`**
  - 对应原 JS：`draw* / renderLink / drawNodeWidgets / processNodeWidgets`。
  - 对应原 d.ts：渲染相关方法。

- [ ] **Audit Task 39: `src/ts-migration/canvas/LGraphCanvas.menu-panel.ts`**
  - 对应原 JS：`showSearchBox/createDialog/createPanel/processContextMenu` 等菜单面板链路。
  - 对应原 d.ts：菜单与面板路径契约。

### F. UI 组件与兼容层

- [ ] **Audit Task 40: `src/ts-migration/ui/ContextMenu.ts`**
  - 对应原 JS：`function ContextMenu` + `addItem/close/getTopMenu/getFirstEvent`。
  - 对应原 d.ts：`ContextMenu` 类接口。

- [ ] **Audit Task 41: `src/ts-migration/ui/context-menu-compat.ts`**
  - 对应原 JS：`closeAllContextMenus` 的入口归属与行为。
  - 对应原 d.ts：菜单关闭 API 的兼容声明。

- [ ] **Audit Task 42: `src/ts-migration/ui/CurveEditor.ts`**
  - 对应原 JS：`function CurveEditor` + `draw/onMouse*/getCloserPoint`。
  - 对应原 d.ts：`CurveEditor` 相关类型路径（若无声明需记录差异）。

---

## 审计进度快照

- 总任务数：`42`
- 已完成：`36`
- 进行中：`0`
- 未开始：`6`
- 最新更新时间：`2026-03-04`

---

## 审计结果记录模板（每项复用）

```md
### Audit Task XX 结果
- 结论：Pass / Partial / Fail
- JS 对照：`src/litegraph.js`（函数/原型路径）
- d.ts 对照：`src/litegraph.d.ts`（类/成员）
- TS 对照：`src/ts-migration/...`
- 发现问题：
  1. ...
  2. ...
- 修复建议：
  1. ...
  2. ...
```

### Audit Task 01 结果
- 结论：Pass（发现 2 处偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LiteGraph.pointerListenerAdd/Remove`（触摸事件包装、pointer fallback、去重、touch passive 选项）
  - `LiteGraph.extendClass`（`hasOwnProperty` 判定与 getter/setter 复制语义）
  - IIFE/exports 段（全局与 CommonJS 挂载）
- d.ts 对照：`src/litegraph.d.ts`
  - `LiteGraph.pointerListenerAdd/Remove`
  - `LiteGraph.extendClass`
  - 顶层 `LiteGraph` 对外聚合 API
- TS 对照：`src/ts-migration/index.ts`
- 发现问题：
  1. `createPointerListenerCompat` 与原实现不一致：缺少 pointer 不可用时 touch fallback、缺少 touch `passive:false`、缺少同一 listener 去重、touch 包装事件类型回写策略不完整。
  2. `extendClass` 与原实现不一致：类属性/原型属性复制使用 `!= null`，未严格按 `hasOwnProperty` 语义，且原型复制时未跳过 inherited enumerable。
- 已实施修复：
  1. 对齐 `pointerListenerAdd/Remove` 语义：补齐 fallback、事件选项、去重与包装逻辑。
  2. 对齐 `extendClass` 复制规则：改为 `hasOwnProperty` 判定，并按原逻辑处理 getter/setter。
  3. 构建验证通过：`node scripts/build-ts-migration.mjs`。

### Audit Task 02 结果
- 结论：Pass（发现 5 处类型契约偏差并已修复）
- JS 对照：`src/litegraph.js`
  - 节点槽、Widget、ContextMenu 结构在运行时调用链中的字段语义
- d.ts 对照：`src/litegraph.d.ts`
  - `IWidget<TValue = any, TOptions = any>`
  - `IButtonWidget extends IWidget<null, {}>`
  - `ITextWidget extends IWidget<string, {}>`
  - `IContextMenuOptions.ignore_item_callbacks?: Boolean`
  - `IContextMenuOptions.extra?: any`
- TS 对照：`src/ts-migration/types/core-types.ts`
- 发现问题：
  1. `IWidget` 泛型默认值使用 `unknown`，与 d.ts 的 `any` 不一致。
  2. `IButtonWidget`、`ITextWidget` 的 options 从 `{}` 收窄为 `Record<string, never>`，与 d.ts 不一致。
  3. `ignore_item_callbacks` 类型用 `boolean`，与 d.ts 的 `Boolean` 不一致。
  4. `extra` 类型用 `unknown`，与 d.ts 的 `any` 不一致。
- 已实施修复：
  1. 将上述 5 处签名全部改为与 d.ts 一致。
  2. 校验通过：`npx tsc --noEmit src/ts-migration/types/core-types.ts`。

### Audit Task 03 结果
- 结论：Pass（发现 5 处序列化类型契约偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LGraph.prototype.serialize/configure`（`config`、`extra`、`links/groups/nodes`）
  - `LLink.prototype.serialize/configure`（`SerializedLLink` 顺序）
  - `LGraphNode.prototype.serialize`（`flags/properties/widgets_values` 字段语义）
  - `LGraphGroup.prototype.serialize/configure`（`font_size` 运行时差异）
- d.ts 对照：`src/litegraph.d.ts`
  - `SerializedLGraphNode`（`flags/properties/widgets_values` 类型）
  - `serializedLGraph`（`config` 类型）
  - `SerializedLLink`、`SerializedLGraphGroup`
- TS 对照：`src/ts-migration/types/serialization.ts`
- 发现问题：
  1. `JSONLikeObject` 使用 `Record<string, unknown>`，导致 `properties` 和 `widgets_values` 相比 d.ts 不必要收窄（应为 `any` 语义）。
  2. `flags` 被声明成任意对象映射，未与 d.ts 的 `Partial<{ collapsed: boolean }>` 对齐。
  3. `serializedLGraph.config` 被声明为 `Record<string, unknown>`，与 d.ts 的 `object` 不一致。
- 已实施修复：
  1. 将 `JSONLikeObject` 调整为 `Record<string, any>`，并将 `properties/widgets_values` 对齐到 d.ts 的宽类型语义。
  2. 将 `flags` 调整为 `Partial<{ collapsed: boolean }>`。
  3. 将 `serializedLGraph.config` 调整为 `object`。
  4. 校验通过：`npx tsc --noEmit src/ts-migration/types/serialization.ts`。

### Audit Task 04 结果
- 结论：Pass（发现 3 处兼容层类型约束偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `GRID_SHAPE`、`onMenuResizeNode`、`onMenuNodeToSubgraph`、`closeAllContextMenus`、`onNodeAdded` 等差异调用点
  - `LLink.serialize/configure`、`LGraphGroup.serialize/configure` 的序列化差异路径
- d.ts 对照：`src/litegraph.d.ts`
  - `SQUARE_SHAPE`、`onResizeNode`、`processNodeDeselected/drawSlotGraphic/touchHandler`
  - `ContextMenu.closeAllContextMenus`、`LGraph.onNodeAdded`
- TS 对照：`src/ts-migration/types/litegraph-compat.ts`
- 发现问题：
  1. `LiteGraphCompatDiffItem.id` 被声明为 `string`，相比兼容声明层（`litegraph-compat.d.ts`）的字面量联合 `LiteGraphCompatDiffId` 过宽，弱化了差异矩阵的静态可追踪性与枚举约束。
  2. `LiteGraphContextMenuCompatHost` 缺少字符串索引签名，导致包装层 `applyContextMenuCloseAllCompat` 与 `ui/context-menu-compat.ts` 的 host 类型不兼容。
  3. `LGraphHooksCompatHost` 缺少字符串索引签名，导致包装层 `invokeGraphOnNodeAddedCompatHook` 与 `models/LGraph.hooks.ts` 的 host 类型不兼容。
- 已实施修复：
  1. 在实现文件中补充 `LiteGraphCompatDiffId` 联合类型，并将 `LiteGraphCompatDiffItem.id` 收敛到该联合类型。
  2. 为 `LiteGraphContextMenuCompatHost`、`LGraphHooksCompatHost` 补充 `[key: string]: unknown`，与被委托兼容模块签名对齐。
  3. 校验通过：`npx tsc --noEmit src/ts-migration/types/litegraph-compat.ts`。

### Audit Task 05 结果
- 结论：Pass（发现 4 处声明层与实现层漂移并已修复）
- JS 对照：`src/litegraph.js`
  - `LiteGraph.closeAllContextMenus`、`LGraph.onNodeAdded` 可选调用链
  - 序列化差异路径（`LLink` 元组顺序、`LGraphGroup.font_size`）
- d.ts 对照：`src/litegraph.d.ts`
  - `SerializedLLink`、`SerializedLGraphGroup`
  - `ContextMenu.closeAllContextMenus`、`LGraph.onNodeAdded`
- TS 对照：`src/ts-migration/types/litegraph-compat.d.ts`
- 发现问题：
  1. `LiteGraphContextMenuCompatHost` 缺少字符串索引签名，低于实现层 host 契约（`litegraph-compat.ts` / `ui/context-menu-compat.ts`）。
  2. `LGraphHooksCompatHost` 缺少字符串索引签名，低于实现层 host 契约（`litegraph-compat.ts` / `models/LGraph.hooks.ts`）。
  3. 声明层仅暴露 `SerializedLLinkRuntimeOrder`，未提供实现层同名导出 `SerializedLLinkRuntime` 的类型别名。
  4. 声明层仅暴露 `SerializedLGraphGroupRuntimeShape`，未提供实现层同名导出 `SerializedLGraphGroupRuntime` 的类型别名。
- 已实施修复：
  1. 为 `LiteGraphContextMenuCompatHost`、`LGraphHooksCompatHost` 增加 `[key: string]: unknown`。
  2. 增加 `SerializedLLinkRuntime` 与 `SerializedLGraphGroupRuntime` 别名导出，确保声明层与实现导出命名兼容。
  3. 校验通过：`npx tsc --noEmit src/ts-migration/types/litegraph-compat.ts` 与 `npx tsc --noEmit src/ts-migration/types/litegraph-compat.d.ts`。

### Audit Task 06 结果
- 结论：Pass（发现 1 处常量逻辑的类型收敛缺陷并已修复）
- JS 对照：`src/litegraph.js`
  - LiteGraph 常量区 `shift_click_do_break_link_from/click_do_break_link_from_key/isBreakLinkModifierPressed`
  - 其余常量默认值与枚举（`VERSION`、形状、方向、链接渲染模式）均已对齐
- d.ts 对照：`src/litegraph.d.ts`
  - LiteGraph 常量声明与枚举约束（`BOX/ROUND/CIRCLE/CARD/ARROW`、`ALWAYS/ON_EVENT/NEVER/ON_TRIGGER` 等）
- TS 对照：`src/ts-migration/core/litegraph.constants.ts`
- 发现问题：
  1. `isBreakLinkModifierPressed` 中对 `shift_click_do_break_link_from` 使用 `!== true && !== false` 分支判断，触发 TypeScript 缩窄冲突（`tsc --noEmit` 报 TS2367），导致该模块单文件类型检查失败。
- 已实施修复：
  1. 将判断改为等价的 `typeof shortcutSetting !== "boolean"` 分支，保持 JS 运行语义不变（布尔值走开关语义，字符串/数组走修饰键语义）。
  2. 校验通过：`npx tsc --noEmit src/ts-migration/core/litegraph.constants.ts`。

### Audit Task 07 结果
- 结论：Pass（完美匹配，无代码修复）
- JS 对照：`src/litegraph.js`
  - 常量来源：`LiteGraph.GRID_SHAPE = 6`（运行时形状常量）
- d.ts 对照：`src/litegraph.d.ts`
  - 声明来源：`LiteGraph.SQUARE_SHAPE: 6`
- TS 对照：`src/ts-migration/core/litegraph.constants.compat.ts`
- 发现问题：
  1. 未发现语义缺口。`resolveGridSquareShapeValue/applyGridSquareShapeAlias/isGridSquareShapeAliasSynced` 已完整覆盖 `GRID_SHAPE` 与 `SQUARE_SHAPE` 双向别名收敛。
  2. 兜底值 `6`、来源优先级（`GRID_SHAPE` > `SQUARE_SHAPE` > fallback）与兼容矩阵一致。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/core/litegraph.constants.compat.ts`。

### Audit Task 08 结果
- 结论：Pass（发现 4 处迁移偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `registerNodeType/unregisterNodeType/createNode/getNodeTypesInCategory/getNodeTypesCategories`
- d.ts 对照：`src/litegraph.d.ts`
  - LiteGraph 工厂与节点注册 API 契约（`registerNodeType/unregisterNodeType/createNode/getNodeType*`）
- TS 对照：`src/ts-migration/core/litegraph.registry.ts`
- 发现问题：
  1. `createNode` 的 `options` 合并路径触发 `TS2862`（泛型实例索引写入不合法），导致单文件类型校验失败。
  2. `getNodeTypesInCategory/getNodeTypesCategories` 过滤比较使用了 `!==`，与原 JS 的 `!=` 语义不一致。
  3. `unregisterNodeType` 从 `Nodes` 删除时使用 `baseClass.name`，与原 JS 的 `base_class.constructor.name` 删除键语义不一致。
  4. `registerNodeType` 写入 `Nodes` 前置判断使用 `baseClass.name`，与原 JS 的 `base_class.constructor.name` 检查语义不一致。
- 已实施修复：
  1. 将 `options` 合并写入改为通过 `Record<string, unknown>` 可写视图，消除 `TS2862`。
  2. 将两个分类过滤比较调整为 `!=`，与 JS 运行时一致。
  3. 对齐 `registerNodeType/unregisterNodeType` 的 `Nodes` 检查与删除键语义到原 JS 行为。
  4. 校验通过：`npx tsc --noEmit src/ts-migration/core/litegraph.registry.ts`。

### Audit Task 09 结果
- 结论：Pass（发现 5 处运行时辅助迁移偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `registerNodeAndSlotType/buildNodeClassFromObject/wrapFunctionAsNode`
  - `isValidConnection/fetchFile/cloneObject/uuidv4/registerSearchboxExtra`
- d.ts 对照：`src/litegraph.d.ts`
  - LiteGraph 运行辅助 API 暴露面（节点包装、重载脚本、工具方法）
- TS 对照：`src/ts-migration/core/litegraph.runtime.ts`
- 发现问题：
  1. `buildNodeClassFromObject` 与 `wrapFunctionAsNode` 为 `classObject.desc` 赋值时，类型缺少 `desc` 字段导致 `TS2339`，单文件 `tsc` 失败。
  2. `registerNodeAndSlotType` 对 `"anonymous"` 哨兵比较使用了非语义化的类型强转写法，可读性差且不利于保持 JS 行为对照。
  3. `registerNodeAndSlotType` 对事件槽类型判断使用 `===`，与原 JS 的 `==` 语义不一致（字符串 `"-1"` 场景会偏离）。
  4. `isValidConnection` 的若干关键比较使用 `===`，与原 JS 的 `==` 语义不一致。
  5. `fetchFile` 对未知 `type` 的字符串 URL 分支回退为 `response.text()`，与原 JS 的“返回 `undefined` 进入回调”语义不一致。
- 已实施修复：
  1. 引入 `GeneratedNodeClassLike`，显式承载 `desc` 字段，修复 `TS2339`。
  2. 重写 `"anonymous"` 分支判断为显式 `unknown` 读值 + `!= "anonymous"`，保持原 JS 判定语义。
  3. 将事件槽与连接判断中的关键比较对齐为 JS 的宽松相等语义（`==`）。
  4. 删除 `fetchFile` 未知类型的 `response.text()` 回退，恢复 JS 语义。
  5. 校验通过：`npx tsc --noEmit src/ts-migration/core/litegraph.runtime.ts`。

### Audit Task 10 结果
- 结论：Pass（完美匹配，无代码修复）
- JS 对照：`src/litegraph.js`
  - `compareObjects`、`distance`、`isInsideRectangle`、`growBounding`、`isInsideBounding`
  - `overlapBounding`（迁移层额外导出给 Canvas/Group 内部复用）
- d.ts 对照：`src/litegraph.d.ts`
  - `compareObjects(a: object, b: object)`
  - `distance(a: Vector2, b: Vector2)`
  - `isInsideRectangle(...)`
  - `growBounding(bounding: Vector4, x: number, y: number): Vector4`
  - `isInsideBounding(p: Vector2, bb: Vector4): boolean`
- TS 对照：`src/ts-migration/utils/math-geometry.ts`
- 发现问题：
  1. 未发现行为差异。核心几何函数的判断分支与原 JS 一致。
  2. `isInsideBounding` 兼容了 `[[min],[max]]` 与 `[min,max]` 两种表示，保持对旧调用路径与 d.ts 声明的双向兼容。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/utils/math-geometry.ts`。

### Audit Task 11 结果
- 结论：Pass（发现 1 处类型契约漂移并已修复）
- JS 对照：`src/litegraph.js`
  - `colorToString/hex2num/num2hex` 的运行时算法与边界行为
- d.ts 对照：`src/litegraph.d.ts`
  - `colorToString(c: string): string`
  - `hex2num(hex: string): [number, number, number]`
  - `num2hex(triplet: [number, number, number]): string`
- TS 对照：`src/ts-migration/utils/color.ts`
- 发现问题：
  1. `colorToString` 参数仅声明为 `ReadonlyArray<number>`，未覆盖 d.ts 的 `string` 形态，存在类型契约漂移。
- 已实施修复：
  1. 为 `colorToString` 增加重载：`(c: string)` 与 `(c: ReadonlyArray<number>)`，实现保持原 JS 运行语义不变。
  2. 校验通过：`npx tsc --noEmit src/ts-migration/utils/color.ts`。

### Audit Task 12 结果
- 结论：Pass（完美匹配，无代码修复）
- JS 对照：`src/litegraph.js`
  - `function clamp(v, a, b) { return a > v ? a : b < v ? b : v; }`
  - `global.clamp = clamp` 全局暴露
- d.ts 对照：`src/litegraph.d.ts`
  - `declare function clamp(v: number, min: number, max: number): number`
- TS 对照：`src/ts-migration/utils/clamp.ts`
- 发现问题：
  1. 未发现行为差异。`clamp` 核心表达式与 JS 完全一致。
  2. 全局暴露路径由 `compat/global-bridge.ts` 负责（`globalScope.clamp = clamp`），与原运行时挂载语义一致。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/utils/clamp.ts`。

### Audit Task 13 结果
- 结论：Pass（完美匹配，无代码修复）
- JS 对照：`src/litegraph.js`
  - `LiteGraph.getParameterNames = function(func) { ... }`
- d.ts 对照：`src/litegraph.d.ts`
  - `getParameterNames(func: string): string[]`
- TS 对照：`src/ts-migration/utils/function-signature.ts`
- 发现问题：
  1. 未发现行为差异。注释剥离、默认值剥离、参数切分流程与原 JS 完全一致。
  2. 迁移实现额外接受函数输入（`string | function`）用于运行时包装节点路径，保持与 JS 实际调用兼容。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/utils/function-signature.ts`。

### Audit Task 14 结果
- 结论：Pass（发现 2 处时间源分支语义偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LiteGraph.getTime` 回退链路：`performance` -> `Date.now` -> `process.hrtime` -> `new Date().getTime()`
- d.ts 对照：`src/litegraph.d.ts`
  - `getTime(): number`
- TS 对照：`src/ts-migration/compat/time-source.ts`
- 发现问题：
  1. `performance` 分支额外检查了 `performance.now`，比原 JS 更保守。
  2. `process` 分支额外检查了 `hrtime` 存在性，比原 JS 更保守。
- 已实施修复：
  1. 将分支判断对齐为原 JS 语义：`typeof performance != "undefined"` 与 `typeof processLike != "undefined"`。
  2. 保持回退顺序与返回值计算公式一致。
  3. 校验通过：`npx tsc --noEmit src/ts-migration/compat/time-source.ts`。

### Audit Task 15 结果
- 结论：Pass（完美匹配，无代码修复）
- JS 对照：`src/litegraph.js`
  - `LiteGraph._normalizeTouchEvent`
  - `LiteGraph._resolvePointerEventName`
  - `LiteGraph._pointerListenerOptions`
  - `LiteGraph.pointerListenerAdd/remove`
- d.ts 对照：`src/litegraph.d.ts`
  - `LiteGraph.pointerListenerAdd/remove` 公开契约（通过入口层挂载）
- TS 对照：`src/ts-migration/compat/pointer-events.ts`
- 发现问题：
  1. 未发现行为差异。pointer 不可用时转 touch、touch 事件包装、listener 去重、remove 时反查 wrapped listener 等关键路径均与原 JS 一致。
  2. `touch` 事件选项 `{ passive: false }` 与 `capture` 传递语义一致，`enter/leave/over/out` 在 touch 模式下不可映射时返回 `null` 的分支一致。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/compat/pointer-events.ts`。

### Audit Task 16 结果
- 结论：Pass（完美匹配，无代码修复）
- JS 对照：`src/litegraph.js`
  - IIFE 全局挂载：`global.LiteGraph`、`global.LGraph`、`global.LGraphNode`、`global.LGraphGroup`、`global.LGraphCanvas`
  - 命名空间挂载：`LiteGraph.LLink`、`LiteGraph.DragAndScale`、`LiteGraph.ContextMenu`、`LiteGraph.CurveEditor`
  - 全局辅助：`global.clamp = clamp`、`window.requestAnimationFrame` shim
- d.ts 对照：`src/litegraph.d.ts`
  - `LiteGraph` 聚合 API 与 `getTime` / 工具函数可见成员契约
- TS 对照：`src/ts-migration/compat/global-bridge.ts`
- 发现问题：
  1. 未发现行为缺口。桥接函数对全局与命名空间挂载位置、`clamp` 暴露、`requestAnimationFrame` shim 行为均与原 JS 语义一致。
  2. `attachLiteGraphGlobalBridgeToGlobalThis` 作为便利入口不改变核心桥接语义。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/compat/global-bridge.ts`。

### Audit Task 17 结果
- 结论：Pass（完美匹配，无代码修复）
- JS 对照：`src/litegraph.js`
  - CommonJS 导出段：`exports.LiteGraph/LGraph/LLink/LGraphNode/LGraphGroup/DragAndScale/LGraphCanvas/ContextMenu`
- d.ts 对照：`src/litegraph.d.ts`
  - 对应命名导出声明（模块使用场景）
- TS 对照：`src/ts-migration/compat/cjs-exports.ts`
- 发现问题：
  1. 未发现缺失导出项。迁移导出集合与原 JS CommonJS 段一致。
  2. 兼容增强（顶层别名缺失时回退到 `LiteGraph.*`）不破坏原行为，仅扩展健壮性。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/compat/cjs-exports.ts`。

### Audit Task 18 结果
- 结论：Pass（发现 2 处 LLink 语义偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LLink` 构造、`configure`（数组/对象直接赋值）、`serialize`（runtime tuple 顺序）
- d.ts 对照：`src/litegraph.d.ts`
  - `LLink` 类签名与 `SerializedLLink`（d.ts 顺序）
- TS 对照：`src/ts-migration/models/LLink.ts`
- 发现问题：
  1. `configure` 通过 compat helper 做了 `Number/String` 强制转换与默认值填充，偏离原 JS 的“按输入原值直接赋值”语义。
  2. `serialize` 通过 compat helper 二次归一化后输出，存在不必要的数据重写风险（原 JS 为直接返回字段元组）。
- 已实施修复：
  1. 将 `configure` 改为直接赋值逻辑，保留原 JS 行为；同时保留对 d.ts 顺序 tuple 的兼容识别（`source[1]` 为 `string` 时按 d.ts 顺序读取）。
  2. 将 `serialize` 改为直接返回 runtime 顺序元组 `[id, origin_id, origin_slot, target_id, target_slot, type]`，与原 JS 一致。
  3. 校验通过：`npx tsc --noEmit src/ts-migration/models/LLink.ts`。

### Audit Task 19 结果
- 结论：Pass（完美匹配，无代码修复）
- JS 对照：`src/litegraph.js`
  - `LLink.serialize()` runtime 顺序：`[id, origin_id, origin_slot, target_id, target_slot, type]`
- d.ts 对照：`src/litegraph.d.ts`
  - `SerializedLLink` 声明顺序：`[id, type, origin_id, origin_slot, target_id, target_slot]`
- TS 对照：`src/ts-migration/models/LLink.serialization.compat.ts`
- 发现问题：
  1. 未发现兼容缺口。`normalizeSerializedLLinkTuple` 与 `denormalizeSerializedLLinkTuple` 已完整覆盖 d.ts/runtime 双顺序互转。
  2. `parseSerializedLLinkInput` 与 `serializeLLinkShape` 形成闭环，满足“输入双格式、输出按 order 控制”的兼容目标。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/models/LLink.serialization.compat.ts`。

### Audit Task 20 结果
- 结论：Pass（发现 3 处生命周期迁移偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LGraph` 构造与生命周期：`clear/attachCanvas/detachCanvas/start/stop/getTime/getFixedTime/getElapsedTime`
- d.ts 对照：`src/litegraph.d.ts`
  - `LGraph` 生命周期成员：`constructor/clear/attachCanvas/detachCanvas/start/stop/getTime/getFixedTime/getElapsedTime`
- TS 对照：`src/ts-migration/models/LGraph.lifecycle.ts`
- 发现问题：
  1. `attachCanvas` 未按原 JS 执行 `graphcanvas.constructor != LGraphCanvas` 的构造函数校验，且抛错类型从字符串漂移为 `Error`。
  2. `attachCanvas` 额外引入了“重复 canvas 去重”逻辑，原 JS 为无条件 `push`。
  3. `start()` 中块级 `function on_frame()` 触发 `TS1251`（ES5 目标下 strict mode 不允许），阻断单文件类型审计。
- 已实施修复：
  1. 为 lifecycle host 增加可选 `LGraphCanvas` 引用并对齐构造函数校验；抛错文案与类型恢复为原 JS 语义：`"attachCanvas expects a LGraphCanvas instance"`。
  2. 移除去重分支，恢复原 JS 的 `list_of_graphcanvas.push(graphcanvas)`。
  3. 将 `on_frame` 改为等价箭头函数，保持执行语义不变并消除 `TS1251`。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/models/LGraph.lifecycle.ts`。

### Audit Task 21 结果
- 结论：Pass（发现 5 处执行链迁移偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LGraph.prototype.runStep`
  - `LGraph.prototype.updateExecutionOrder`
  - `LGraph.prototype.computeExecutionOrder`
  - `LGraph.prototype.getAncestors`
  - `LGraph.prototype.arrange`
- d.ts 对照：`src/litegraph.d.ts`
  - `LGraph.runStep/updateExecutionOrder/computeExecutionOrder/getAncestors/arrange`
- TS 对照：`src/ts-migration/models/LGraph.execution.ts`
- 发现问题：
  1. `runStep` 对 `executePendingActions` 增加了存在性保护，偏离原 JS 的直接调用语义。
  2. `runStep` 在 `do_not_catch_errors` 分支把 `node.doExecute()` 改成了 `doExecute/onExecute` 回退，偏离原 JS。
  3. `computeExecutionOrder` 的临时字典键使用 `Record<number,...>`，对字符串 ID（UUID 模式）键语义不稳。
  4. `getAncestors` 增加 `getInputNode` 保护分支，偏离原 JS 的直接调用路径。
  5. `arrange` 对 `setDirtyCanvas` 加了可选保护，原 JS 为无条件调用。
- 已实施修复：
  1. 对齐 `runStep` 到原 JS：移除额外保护，恢复 `executePendingActions` 与 `doExecute` 直接调用语义。
  2. 将执行序图内部字典改为字符串键路径（`Record<string,...>` + `String(id)`），确保与 JS 对象键行为一致。
  3. `getAncestors` 恢复直接调用 `getInputNode(i)`。
  4. `arrange` 恢复无条件 `setDirtyCanvas(true, true)`。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/models/LGraph.execution.ts`。

### Audit Task 22 结果
- 结论：Pass（发现 6 处结构层迁移偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LGraph.prototype.add/remove/getNodeById/findNodesByClass/findNodesByType/findNodeByTitle/findNodesByTitle/getNodeOnPos/getGroupOnPos/checkNodeTypes`
- d.ts 对照：`src/litegraph.d.ts`
  - `LGraph.add/remove/getNodeById/find*/getNodeOnPos/getGroupOnPos`
- TS 对照：`src/ts-migration/models/LGraph.structure.ts`
- 发现问题：
  1. `add` 在非 UUID 分支额外引入 `typeof id !== "number"` 防御条件，偏离原 JS 的宽松分支。
  2. `add` 在 `align_to_grid` 路径额外校验 `alignToGrid` 存在性，偏离原 JS 直接调用语义。
  3. `getNodeById` 把“未命中”强制归一为 `null`，与 JS 的对象访问返回 `undefined` 不一致。
  4. `remove` 针对 `selected_nodes` 的访问路径比原 JS 更保守，行为分支漂移。
  5. 迁移层缺失 `checkNodeTypes` 方法（原 JS 存在，虽 d.ts 未声明，但属于运行时原型能力）。
  6. `onNodeAdded` 调用点需要与兼容 hook 主机签名显式对齐。
- 已实施修复：
  1. 对齐 `add` 的非 UUID 分支判断与 `align_to_grid` 直接调用语义。
  2. 将 `getNodeById` 调整为保留对象访问返回值（未命中为 `undefined`，`id == null` 仍返回 `null`）。
  3. 对齐 `remove` 的画布已选节点清理路径，保持原链路语义。
  4. 新增 `checkNodeTypes` 实现，按原 JS 路径执行节点类型替换与执行顺序重算。
  5. 调整 `onNodeAdded` 兼容 hook 调用的宿主类型对齐。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/models/LGraph.structure.ts`。

### Audit Task 23 结果
- 结论：Pass（发现 7 处图级 IO/事件链迁移偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LGraph.prototype.sendEventToAllNodes`
  - `LGraph.prototype.sendActionToCanvas`
  - `LGraph.prototype.onAction/trigger/triggerInput/setCallback`
  - `LGraph.prototype.beforeChange/afterChange/connectionChange`
  - `LGraph.prototype.isLive/clearTriggeredSlots/change/setDirtyCanvas`
- d.ts 对照：`src/litegraph.d.ts`
  - `onAction/trigger/addInput...setDirtyCanvas` 一组图级 IO 与事件接口
- TS 对照：`src/ts-migration/models/LGraph.io-events.ts`
- 发现问题：
  1. `sendEventToAllNodes` 对 `Subgraph.sendEventToAllNodes` 增加存在性保护，偏离原 JS 直接调用语义。
  2. `sendEventToAllNodes` 将 `node[eventname]` 从“truthy 判断”收窄为“函数判断”，改变了原 JS 的异常路径行为。
  3. `sendActionToCanvas` 从 `(action, params)` 改为 rest 参数并重写 payload 组装，偏离原调用语义。
  4. `onAction` 对 `GraphInput` 存在性提前返回，导致 `_input_nodes` 刷新路径与原 JS 不一致。
  5. `onAction` 对 `properties/actionDo` 增加可选保护，偏离原 JS 直接访问与调用语义。
  6. `triggerInput/setCallback` 对 `onTrigger/setTrigger` 增加可选保护，偏离原 JS。
  7. `beforeChange/afterChange` 传给 `sendActionToCanvas` 的参数形态偏离原 JS（应直接传 `this`）。
- 已实施修复：
  1. 恢复 `sendEventToAllNodes` 的原始判断与调用分支（含 Subgraph 递归分发路径）。
  2. 恢复 `sendActionToCanvas(action, params)` 原型签名与 `apply(c, params)` 行为。
  3. `onAction` 恢复 `_input_nodes` 固定刷新路径，并恢复 `properties.name` / `actionDo` 的直接调用语义。
  4. `triggerInput` 与 `setCallback` 恢复对节点回调的直接调用。
  5. `beforeChange/afterChange` 恢复向 canvas 分发 `this` 作为第二参数。
  6. 调整类型桥接以满足继承约束，不改变上述运行时行为。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/models/LGraph.io-events.ts`。

### Audit Task 24 结果
- 结论：Pass（发现 8 处持久化链路迁移偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LGraph.prototype.removeLink`
  - `LGraph.prototype.serialize`
  - `LGraph.prototype.configure`
  - `LGraph.prototype.load`
  - `LGraph.prototype.onNodeTrace`
- d.ts 对照：`src/litegraph.d.ts`
  - `removeLink/serialize/configure/load`
- TS 对照：`src/ts-migration/models/LGraph.persistence.ts`
- 发现问题：
  1. `removeLink` 对 `disconnectInput` 增加存在性保护，偏离原 JS 直接调用语义。
  2. `serialize` 对节点/分组 `serialize()` 增加存在性保护，偏离原 JS。
  3. `serialize/configure` 中 `LLink` 实例化使用有参构造，偏离原 JS 的 `new LLink()` 语义。
  4. `configure` 对 `createNode` 调用增加可选保护，偏离原 JS 直接调用路径。
  5. `configure` 在节点二次配置与分组配置路径增加方法存在性保护，偏离原 JS。
  6. `configure` 的 `links` 解码容器使用对象形态，和原 JS 的数组索引容器语义不一致。
  7. `load` 对 `File/Blob` 判断增加 `typeof` 防御，偏离原 JS。
  8. 迁移层 fallback 节点构造路径与原 JS 的 `new LGraphNode()` 语义不一致。
- 已实施修复：
  1. 对齐 `removeLink/serialize/configure` 的直接调用语义，移除额外防御分支。
  2. 将 `LLink` 实例化改为无参构造语义（通过构造签名桥接），对齐原 JS。
  3. `configure` 的 links 解码容器恢复为数组索引形式。
  4. `createNode/LGraphNode/LGraphGroup` 路径改为与原 JS 一致的直接调用链（通过类型桥接保证可编译）。
  5. `load` 的 File/Blob 检测恢复为原 JS 条件表达式。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/models/LGraph.persistence.ts`。

### Audit Task 25 结果
- 结论：Pass（发现 1 处 hook 触发语义偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LGraph.prototype.add` 中触发点：`if (this.onNodeAdded) { this.onNodeAdded(node); }`
- d.ts 对照：`src/litegraph.d.ts`
  - `LGraph.onNodeAdded(node: LGraphNode): void`
- TS 对照：`src/ts-migration/models/LGraph.hooks.ts`
- 发现问题：
  1. `invokeGraphOnNodeAddedCompatHook` 使用“仅函数才调用”的安全策略，会吞掉非函数 truthy 值导致的原生异常路径，偏离原 JS。
- 已实施修复：
  1. 恢复为 truthy 即尝试调用的语义：仅在 falsy 时返回，truthy 时直接调用并保留原始异常行为。
  2. 同步更新注释，明确该 helper 追求运行时语义对齐而非额外防御。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/models/LGraph.hooks.ts`。

### Audit Task 26 结果
- 结论：Pass（发现 7 处节点状态层迁移偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `function LGraphNode`
  - `LGraphNode.prototype._ctor`
  - `LGraphNode.prototype.configure`
  - `LGraphNode.prototype.serialize`
  - `LGraphNode.prototype.clone`
  - `LGraphNode.prototype.setProperty`
- d.ts 对照：`src/litegraph.d.ts`
  - `LGraphNode.configure/serialize/clone/setProperty` 及节点基础状态字段
- TS 对照：`src/ts-migration/models/LGraphNode.state.ts`
- 发现问题：
  1. `_ctor` 未复刻运行时对 `pos` 的 `Object.defineProperty(..., enumerable: true)` 语义。
  2. `configure` 在 `properties` 路径使用了 `|| {}` 防御，偏离原 JS 的直接迭代语义。
  3. `configure` 中标题回退使用了 `"Unnamed"` 兜底，偏离原 JS 的 `this.constructor.title` 赋值语义。
  4. `configure` 中 widget 属性同步对 `null` 的判定使用 `!== undefined`，与原 JS 的 `!= undefined` 不一致。
  5. `serialize` 的 `title/type` 回退逻辑加入了额外兜底（`"Unnamed"`/`null`），偏离原 JS。
  6. `clone` 对 `createNode` 增加可选保护，偏离原 JS 的直接调用路径。
  7. `SerializedLGraphNodeState` 使用交叉类型导致 `id` 被意外收窄为 `number`，与 UUID 语义冲突。
- 已实施修复：
  1. 在 `_ctor` 中恢复 `pos` 的 `defineProperty` 可枚举访问器语义。
  2. `configure` 的 `properties/title/widget` 分支恢复为原 JS 等价判断和赋值路径。
  3. `serialize/getTitle` 的 `constructor.title/type` 回退逻辑恢复到原 JS 语义。
  4. `clone` 恢复直接调用 `createNode(this.type)`（用类型桥接保证可编译）。
  5. 将 `SerializedLGraphNodeState` 改为 `Omit<Partial<SerializedLGraphNode>, "id"> + id?: number|string`，修复 UUID 场景类型漂移。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/models/LGraphNode.state.ts`。

### Audit Task 27 结果
- 结论：Pass（发现 9 处节点执行链迁移偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LGraphNode.prototype.setOutputData/setOutputDataType/getInputData/getInputDataType/getInputDataByName`
  - `LGraphNode.prototype.isInputConnected/getInputInfo/getInputLink/getInputNode/getInputOrProperty/getOutputData/getOutputInfo/isOutputConnected/isAnyOutputConnected/getOutputNodes`
  - `LGraphNode.prototype.executePendingActions/doExecute/actionDo/trigger/triggerSlot/clearTriggeredSlot`
- d.ts 对照：`src/litegraph.d.ts`
  - 节点执行相关 API（`setOutputData*`、输入输出数据访问、`trigger*`）
- TS 对照：`src/ts-migration/models/LGraphNode.execution.ts`
- 发现问题：
  1. `setOutputData/setOutputDataType/getInputData/getInputDataType/clearTriggeredSlot` 对 graph 增加早返回防御，偏离原 JS 直接访问语义。
  2. `getInputDataByName` 依赖可选 `findInputSlot` 防御路径，偏离原 JS 直接调用语义。
  3. `executePendingActions` 对 `onAction` 增加存在性保护，偏离原 JS。
  4. `doExecute/actionDo` 对 `graph.nodes_*` 与 `nodes_executedAction` 增加防御分支，偏离原 JS。
  5. `triggerSlot` 在 `ON_TRIGGER` 分支对 `doExecute` 增加回退到 `onExecute`，偏离原 JS。
  6. `triggerSlot` 在 `onAction` 分支对 `target_connection/actionDo/onAction` 增加保护与回退，偏离原 JS。
  7. d.ts 已声明的一组输入/输出查询方法在迁移层缺失（`isInputConnected/getInputInfo/getInputLink/getInputNode/getInputOrProperty/getOutputData/getOutputInfo/isOutputConnected/isAnyOutputConnected/getOutputNodes`）。
  8. 运行时 graph 类型桥接不完整，导致单文件审计编译失败（类型互转告警）。
  9. 部分返回值语义未完全贴近 JS（输入/输出查询方法的 `null/undefined` 约定）。
- 已实施修复：
  1. 对齐执行链核心方法的 graph 访问语义，移除多余防御分支。
  2. 恢复 `getInputDataByName` 的直接 `findInputSlot` 路径。
  3. 恢复 `executePendingActions/doExecute/actionDo/triggerSlot` 的原始调用链与异常语义。
  4. 补齐 d.ts 声明所需的输入/输出查询方法并按 JS 行为实现。
  5. 完善 graph 类型桥接（`unknown` 中转）以通过 TS 审计编译且不改变运行时语义。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/models/LGraphNode.execution.ts`。

### Audit Task 28 结果
- 结论：Pass（发现 8 处端口/Widget 迁移偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LGraphNode.prototype.addProperty/addOutput/addOutputs/removeOutput/addInput/addInputs/removeInput/addConnection/computeSize/getPropertyInfo/addWidget/addCustomWidget`
- d.ts 对照：`src/litegraph.d.ts`
  - 节点端口与 Widget API（含 `addProperty/removeOutput/removeInput/addConnection`）
- TS 对照：`src/ts-migration/models/LGraphNode.ports-widgets.ts`
- 发现问题：
  1. 迁移层缺失 `addProperty` 方法。
  2. 迁移层缺失 `removeOutput` 方法。
  3. 迁移层缺失 `removeInput` 方法。
  4. 迁移层缺失 `addConnection` 方法。
  5. `addInput/addInputs` 对 `registerNodeAndSlotType` 增加可选保护，偏离原 JS 直接调用语义。
  6. `addOutput/addOutputs` 在自动注册分支也引入可选保护，偏离原 JS。
  7. `computeSize` 默认 `out` 容器与原 JS 的 `Float32Array([0,0])` 语义不一致。
  8. `addWidget` 的 `type` 处理加入了额外字符串兜底，偏离原 JS 的直接 `toLowerCase()` 路径。
- 已实施修复：
  1. 补齐 `addProperty/removeOutput/removeInput/addConnection`，按原 JS 链路实现（含链接索引重排逻辑与回调触发）。
  2. 恢复端口类型注册调用语义：输入路径直接调用，输出路径在 `auto_load_slot_types` 下直接调用。
  3. `addOutputs` 保留原 JS 的输出槽对象形态（`link` 字段路径）以维持运行时兼容。
  4. `computeSize` 默认输出容器恢复为 `Float32Array([0,0])` 语义。
  5. `addWidget` 的 `type` 处理恢复直接 `toLowerCase()` 路径。
  6. 同步处理继承私有方法重名与类型桥接，保证不改运行语义。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/models/LGraphNode.ports-widgets.ts`。

### Audit Task 29 结果
- 结论：Pass（发现 8 处连接与几何迁移偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LGraphNode.prototype.findSlotByType`
  - `LGraphNode.prototype.connectByType/connectByTypeOutput/connect`
  - `LGraphNode.prototype.disconnectOutput/disconnectInput`
  - `LGraphNode.prototype.getConnectionPos`
- d.ts 对照：`src/litegraph.d.ts`
  - `LGraphNode.findInputSlot/findOutputSlot/connect/disconnectOutput/disconnectInput/getConnectionPos`
- TS 对照：`src/ts-migration/models/LGraphNode.connect-geometry.ts`
- 发现问题：
  1. `findSlotByType` 将“preferFreeSlot 回退匹配”抽成统一 helper，导致第二轮匹配错误继承 `_event_` 归一化，偏离原 JS 分支语义。
  2. `connectByType/connectByTypeOutput` 增加了多处可选防御分支（`?.`/存在性判断），与原 JS 的直接调用路径不一致。
  3. `connect` 在 `target_slot` 变更后的校验链加入了额外空值保护，改变了原 JS 的异常路径。
  4. `connect` 缺少 `this.outputs[slot]` 稀疏槽位检查，与原 JS 不一致。
  5. `disconnectOutput` 对目标分支的 `link/input` 增加保护，导致回调触发链与异常路径偏离。
  6. `disconnectOutput` 全量断开分支中 `onNodeConnectionChange(INPUT, target, ...)` 的二次通知条件与原 JS 不一致。
  7. `disconnectInput` 缺少原 JS 的 `input` 空槽位返回分支，且对 origin 节点路径增加了额外防御。
  8. `getConnectionPos` 额外支持字符串槽名解析，偏离原 JS 的原始槽位计算语义。
- 已实施修复：
  1. 将 `findSlotByType` 改为两段式匹配流程，对齐原 JS 两轮循环行为。
  2. 收敛 `connectByType/connectByTypeOutput` 到原 JS 的直接调用语义。
  3. 对齐 `connect` 的目标槽位分支、输出槽位检查、回调与连接变更调用链。
  4. 对齐 `disconnectOutput/disconnectInput` 的链接移除、回调触发、版本递增与通知顺序。
  5. 移除 `getConnectionPos` 的字符串槽名转换，恢复原 JS 计算路径。
  6. 补充必要类型桥接（不改变运行时语义），保证单文件审计可编译。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/models/LGraphNode.connect-geometry.ts`。

### Audit Task 30 结果
- 结论：Pass（发现 6 处画布协作迁移偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LGraphNode.prototype.alignToGrid`
  - `LGraphNode.prototype.trace`
  - `LGraphNode.prototype.setDirtyCanvas`
  - `LGraphNode.prototype.captureInput`
  - `LGraphNode.prototype.collapse/pin/localToScreen`
- d.ts 对照：`src/litegraph.d.ts`
  - `LGraphNode.alignToGrid/trace/setDirtyCanvas/loadImage/captureInput/collapse/pin/localToScreen`
- TS 对照：`src/ts-migration/models/LGraphNode.canvas-collab.ts`
- 发现问题：
  1. `trace` 对 `MAX_CONSOLE` 加了 `!= null` 保护，偏离原 JS 的直接比较语义。
  2. `trace` 使用了 `graph?.onNodeTrace` 可选调用，吞掉了原 JS 在无 graph 场景下的异常路径。
  3. `setDirtyCanvas` 对 `sendActionToCanvas` 使用可选调用，偏离原 JS 直接调用语义。
  4. `captureInput` 参数类型使用 `unknown`，与 d.ts 的 `any` 契约不一致。
  5. `collapse` 对 `graph._version++` 增加 graph 存在性保护，偏离原 JS。
  6. `pin` 对 `graph._version++` 增加 graph 存在性保护，偏离原 JS。
- 已实施修复：
  1. 恢复 `trace` 的 `MAX_CONSOLE` 直接比较语义。
  2. 恢复 `trace` 对 `graph.onNodeTrace` 的原始访问/调用链。
  3. `setDirtyCanvas` 恢复 `sendActionToCanvas("setDirty", ...)` 直接调用。
  4. `captureInput` 参数签名对齐为 `any`。
  5. `collapse/pin` 恢复 `graph._version++` 的直接执行语义。
  6. 调整内部 graph 访问桥接与私有方法命名，保证继承层类型检查通过且不改变运行时行为。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/models/LGraphNode.canvas-collab.ts`。

### Audit Task 31 结果
- 结论：Pass（发现 5 处 LGraphGroup 迁移偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `function LGraphGroup`
  - `LGraphGroup.prototype._ctor/configure/serialize/move/recomputeInsideNodes`
  - `LGraphGroup.prototype.isPointInside/setDirtyCanvas`（委托）
- d.ts 对照：`src/litegraph.d.ts`
  - `LGraphGroup.configure/serialize/move/recomputeInsideNodes`
  - `LGraphGroup.isPointInside/setDirtyCanvas`
- TS 对照：`src/ts-migration/models/LGraphGroup.ts`
- 发现问题：
  1. `pos/size` 使用 class accessor，未对齐原 JS 在 `_ctor` 中通过 `Object.defineProperty(..., enumerable:true)` 的实例级属性语义。
  2. `configure` 走 `parseSerializedLGraphGroupInput` 兼容归一化，偏离原 JS 的直接字段赋值语义。
  3. `serialize` 走 `serializeLGraphGroupShape` 兼容层，偏离原 JS 直接构造运行时对象语义。
  4. `recomputeInsideNodes` 增加 graph 空值保护，偏离原 JS 的直接访问链（`this.graph._nodes`）。
  5. `_ctor` 的 `pos/size` 定义路径未完整复刻，导致实例属性可枚举性与原实现不一致。
- 已实施修复：
  1. 在 `_ctor` 中恢复 `Object.defineProperty` 方式定义 `pos/size`，并设置 `enumerable: true`。
  2. 将 `configure` 改回原 JS 等价的直接赋值实现。
  3. 将 `serialize` 改回原 JS 等价的直接对象构造实现（含 `Math.round`）。
  4. 将 `recomputeInsideNodes` 恢复为直接读取 `this.graph._nodes` 的路径。
  5. 移除本文件对 group-serialization compat helper 的依赖，避免兼容层改变核心运行时语义。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/models/LGraphGroup.ts`。

### Audit Task 32 结果
- 结论：Pass（发现 2 处序列化兼容语义偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LGraphGroup.prototype.configure` 直接读取 `font_size`
  - `LGraphGroup.prototype.serialize` 直接输出 `font_size`
- d.ts 对照：`src/litegraph.d.ts`
  - `SerializedLGraphGroup.font`（声明层字段）
- TS 对照：`src/ts-migration/models/LGraphGroup.serialization.compat.ts`
- 发现问题：
  1. `normalizeSerializedLGraphGroup` 对 `title/color` 做 `String(...)` 强制转换，超出兼容桥接职责，可能改变原值语义。
  2. `serializeLGraphGroupShape` 对 runtime 形状做 `String/Number` 强制归一化，可能将 `undefined/null` 等输入改写为 `""/0`，偏离“仅字段映射兼容”的目标。
- 已实施修复：
  1. `normalizeSerializedLGraphGroup` 仅保留 `font/font_size` 的兼容归一化，不再强制转换 `title/color`。
  2. `serializeLGraphGroupShape` 仅执行结构映射与字段名转换（`font_size <-> font`），移除多余类型强转。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/models/LGraphGroup.serialization.compat.ts`。

### Audit Task 33 结果
- 结论：Pass（发现 4 处 DragAndScale 迁移偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `function DragAndScale`
  - `DragAndScale.prototype.bindEvents/computeVisibleArea/onMouse/changeScale`
- d.ts 对照：`src/litegraph.d.ts`
  - `DragAndScale` 全部实例方法签名
- TS 对照：`src/ts-migration/canvas/DragAndScale.ts`
- 发现问题：
  1. `bindEvents` 额外写入 `this.element = element`，偏离原 JS 行为。
  2. `computeVisibleArea` 对 `width/height` 使用 `clientWidth/clientHeight` 回退，偏离原 JS 仅使用 `element.width/height`。
  3. `onMouse` 增加了 `canvas` 空值防御与 `_binded_mouse_callback` 存在性防御，改变原 JS 的异常路径与调用语义。
  4. `onMouse` 的滚轮分支为 `deltaY/detail` 增加了 `0` 兜底，偏离原 JS 的直接数值运算路径。
- 已实施修复：
  1. 移除 `bindEvents` 中对 `this.element` 的额外赋值。
  2. `computeVisibleArea` 恢复 `element.width/element.height` 路径。
  3. `onMouse` 恢复原 JS 直接调用语义（去掉多余防御分支）。
  4. 滚轮计算恢复为原 JS 等价表达（不引入额外默认值）。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/canvas/DragAndScale.ts`。

### Audit Task 34 结果
- 结论：Pass（发现 8 处 LGraphCanvas 静态区迁移偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LGraphCanvas.onGroupAdd/alignNodes/onNodeAlign/onGroupAlign/onMenuAdd`
  - `LGraphCanvas.showMenuNodeOptionalInputs/showMenuNodeOptionalOutputs`
  - `LGraphCanvas.onShowMenuNodeProperties/onMenuResizeNode`
  - `LGraphCanvas.onMenuNodeCollapse/onMenuNodePin/onMenuNodeMode/onMenuNodeShapes`
  - `LGraphCanvas.onMenuNodeRemove/onMenuNodeToSubgraph/onMenuNodeClone`
- d.ts 对照：`src/litegraph.d.ts`
  - `LGraphCanvas` 静态菜单相关回调与工具方法签名
- TS 对照：`src/ts-migration/canvas/LGraphCanvas.static.ts`
- 发现问题：
  1. `onGroupAdd` 增加了 `canvas.graph` 防御与 `LGraphGroup` 缺失 fallback，对齐性弱于原 JS。
  2. `alignNodes` 增加 `active_canvas` 为空保护与边界节点空值保护，偏离原 JS 直接赋值路径。
  3. `onNodeAlign/onGroupAlign` 使用可选链与字符串兜底，偏离原 JS 的 `value.toLowerCase()` 与直接读取 `active_canvas.selected_nodes`。
  4. `onMenuAdd` 对 `getFirstEvent/beforeChange/afterChange` 使用防御调用，偏离原 JS。
  5. `showMenuNodeOptionalInputs/Outputs` 对 `beforeChange/afterChange/addInput/addOutput/setDirtyCanvas` 使用可选调用，偏离原 JS。
  6. `onShowMenuNodeProperties` 对 `getPropertyInfo` 增加 fallback，偏离原 JS 直接调用。
  7. `onMenuResizeNode` 把 `computeSize` 改成“有则调用”分支，偏离原 JS 直接调用。
  8. `onMenuNodeCollapse/Pin/Mode/Shapes/Remove/ToSubgraph/Clone` 多处引入可选链与提前返回，偏离原 JS 直接调用链。
- 已实施修复：
  1. 收敛 `onGroupAdd/alignNodes/onNodeAlign/onGroupAlign/onMenuAdd` 到原 JS 直接访问语义。
  2. 收敛可选输入/输出菜单与属性菜单逻辑，恢复关键回调的直接调用路径。
  3. `onMenuResizeNode` 恢复 `computeSize()` 直接调用语义。
  4. 收敛节点菜单动作相关方法中的可选链，恢复原 JS 的变更链与调用时序。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/canvas/LGraphCanvas.static.ts`。

### Audit Task 35 结果
- 结论：Pass（发现 2 处静态兼容层偏差并已修复）
- JS 对照：`src/litegraph.js`
  - 运行时仅存在 `onMenuResizeNode/onMenuNodeToSubgraph`，缺失声明别名场景
  - `getPropertyPrintableValue` 默认路径语义为 `String(value)`
- d.ts 对照：`src/litegraph.d.ts`
  - `LGraphCanvas.onResizeNode` 声明存在，需由兼容层桥接到 runtime
- TS 对照：`src/ts-migration/canvas/LGraphCanvas.static.compat.ts`
- 发现问题：
  1. fallback `getPropertyPrintableValue` 使用 `String(value ?? "")`，会把 `undefined` 归一为空字符串，偏离原 JS 默认语义。
  2. 模块头注释错误写为 “Task 42 compatibility layer”，与当前职责不符，存在维护误导。
- 已实施修复：
  1. 将 fallback 调整为 `String(value)`，对齐原 JS 默认转换语义。
  2. 修正文档注释为通用静态兼容层说明。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/canvas/LGraphCanvas.static.compat.ts`。

### Audit Task 36 结果
- 结论：Pass（发现 8 处生命周期迁移偏差并已修复）
- JS 对照：`src/litegraph.js`
  - `LGraphCanvas.prototype.setGraph/getTopGraph/openSubgraph/closeSubgraph`
  - `LGraphCanvas.prototype.bindEvents/unbindEvents`
  - `LGraphCanvas.prototype.getCanvasWindow/startRendering`
- d.ts 对照：`src/litegraph.d.ts`
  - `LGraphCanvas.setGraph/openSubgraph/closeSubgraph/setCanvas/bindEvents/unbindEvents/getCanvasWindow/startRendering/stopRendering`
- TS 对照：`src/ts-migration/canvas/LGraphCanvas.lifecycle.ts`
- 发现问题：
  1. `setGraph` 额外写入 `this.graph = null` 且存在 `!graph` 早返回，吞掉了原 JS 在空参路径的原始调用语义。
  2. `getTopGraph` 使用空保护分支，偏离原 JS 直接访问 `_graph_stack.length` 的路径。
  3. `openSubgraph` 对 `checkPanels` 使用可选调用，偏离原 JS 直接调用语义。
  4. `closeSubgraph` 对 `this.graph._subgraph_node` 和 `centerOnNode/selectNodes` 使用防御式分支，偏离原 JS。
  5. `bindEvents` 对 `canvas` 增加空值提前返回，偏离原 JS 调用链。
  6. `unbindEvents` 对 `canvas` 与回调移除流程增加存在性判断，偏离原 JS 的直接 remove 语义。
  7. `getCanvasWindow` 缺少 `doc.parentWindow` 回退且引入异常抛出分支，与原 JS 不一致。
  8. `startRendering` 使用 `draw?.()` 与 `requestAnimationFrame` fallback，偏离原 JS 的直接渲染循环语义。
- 已实施修复：
  1. `setGraph/getTopGraph/openSubgraph/closeSubgraph` 全部回收到原 JS 等价调用路径。
  2. `bindEvents/unbindEvents` 移除多余防御分支，恢复事件绑定与解绑链路。
  3. `getCanvasWindow` 恢复 `window` 与 `ownerDocument.defaultView || parentWindow` 语义。
  4. `startRendering` 恢复原 JS 的 `renderFrame.call(this)` + `requestAnimationFrame(renderFrame.bind(this))` 循环。
  5. `processTouch.target` 补齐 `event.target || this.canvas` 回退行为。
- 验证：
  1. 类型校验通过：`npx tsc --noEmit src/ts-migration/canvas/LGraphCanvas.lifecycle.ts`。
