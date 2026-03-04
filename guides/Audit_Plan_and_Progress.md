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

- [ ] **Audit Task 16: `src/ts-migration/compat/global-bridge.ts`**
  - 对应原 JS：IIFE 全局桥接。
  - 对应原 d.ts：全局对象可见成员。

- [ ] **Audit Task 17: `src/ts-migration/compat/cjs-exports.ts`**
  - 对应原 JS：CommonJS 导出段落。
  - 对应原 d.ts：模块导出命名一致性。

### D. 数据模型：LLink / LGraph / LGraphNode / LGraphGroup

- [ ] **Audit Task 18: `src/ts-migration/models/LLink.ts`**
  - 对应原 JS：`function LLink` + `LLink.prototype.configure/serialize`。
  - 对应原 d.ts：`LLink` 类定义。

- [ ] **Audit Task 19: `src/ts-migration/models/LLink.serialization.compat.ts`**
  - 对应原 JS：link 序列化历史顺序兼容。
  - 对应原 d.ts：`SerializedLLink` 顺序兼容语义。

- [ ] **Audit Task 20: `src/ts-migration/models/LGraph.lifecycle.ts`**
  - 对应原 JS：`function LGraph` + `clear/start/stop/getTime*`。
  - 对应原 d.ts：`LGraph` 生命周期成员。

- [ ] **Audit Task 21: `src/ts-migration/models/LGraph.execution.ts`**
  - 对应原 JS：`runStep/updateExecutionOrder/computeExecutionOrder/getAncestors/arrange`。
  - 对应原 d.ts：图执行调度相关成员。

- [ ] **Audit Task 22: `src/ts-migration/models/LGraph.structure.ts`**
  - 对应原 JS：`add/remove/getNodeById/find*/getNodeOnPos/getGroupOnPos`。
  - 对应原 d.ts：图结构管理 API。

- [ ] **Audit Task 23: `src/ts-migration/models/LGraph.io-events.ts`**
  - 对应原 JS：`addInput/addOutput/triggerInput/sendEventToAllNodes/connectionChange`。
  - 对应原 d.ts：图级 I/O 与事件接口。

- [ ] **Audit Task 24: `src/ts-migration/models/LGraph.persistence.ts`**
  - 对应原 JS：`serialize/configure/load/removeLink/onNodeTrace`。
  - 对应原 d.ts：序列化/反序列化契约。

- [ ] **Audit Task 25: `src/ts-migration/models/LGraph.hooks.ts`**
  - 对应原 JS：`onNodeAdded` 回调触发点。
  - 对应原 d.ts：`LGraph` hook 声明一致性。

- [ ] **Audit Task 26: `src/ts-migration/models/LGraphNode.state.ts`**
  - 对应原 JS：`function LGraphNode` + `_ctor/configure/serialize/clone/setProperty`。
  - 对应原 d.ts：`LGraphNode` 基础状态与属性 API。

- [ ] **Audit Task 27: `src/ts-migration/models/LGraphNode.execution.ts`**
  - 对应原 JS：`setOutputData/getInputData/doExecute/actionDo/trigger/triggerSlot`。
  - 对应原 d.ts：节点执行相关 API。

- [ ] **Audit Task 28: `src/ts-migration/models/LGraphNode.ports-widgets.ts`**
  - 对应原 JS：`addInput/addOutput/addWidget/computeSize/getPropertyInfo`。
  - 对应原 d.ts：端口与 widget 相关定义。

- [ ] **Audit Task 29: `src/ts-migration/models/LGraphNode.connect-geometry.ts`**
  - 对应原 JS：`find*Slot* / connect* / disconnect* / getConnectionPos / getBounding / isPointInside`。
  - 对应原 d.ts：连接与几何 API。

- [ ] **Audit Task 30: `src/ts-migration/models/LGraphNode.canvas-collab.ts`**
  - 对应原 JS：`alignToGrid/trace/setDirtyCanvas/loadImage/collapse/pin/localToScreen`。
  - 对应原 d.ts：画布协作行为契约。

- [ ] **Audit Task 31: `src/ts-migration/models/LGraphGroup.ts`**
  - 对应原 JS：`function LGraphGroup` + `configure/serialize/move/recomputeInsideNodes`。
  - 对应原 d.ts：`LGraphGroup` 声明。

- [ ] **Audit Task 32: `src/ts-migration/models/LGraphGroup.serialization.compat.ts`**
  - 对应原 JS：`font_size` 运行时字段。
  - 对应原 d.ts：`font` 字段声明兼容。

### E. 画布层：DragAndScale / LGraphCanvas

- [ ] **Audit Task 33: `src/ts-migration/canvas/DragAndScale.ts`**
  - 对应原 JS：`function DragAndScale` + 缩放平移换算链路。
  - 对应原 d.ts：`DragAndScale` 类声明。

- [ ] **Audit Task 34: `src/ts-migration/canvas/LGraphCanvas.static.ts`**
  - 对应原 JS：`LGraphCanvas.*` 静态方法与静态字段。
  - 对应原 d.ts：`LGraphCanvas` 静态 API。

- [ ] **Audit Task 35: `src/ts-migration/canvas/LGraphCanvas.static.compat.ts`**
  - 对应原 JS：静态 API 历史命名差异与缺口补齐策略。
  - 对应原 d.ts：静态兼容别名与补丁类型。

- [ ] **Audit Task 36: `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts`**
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
- 已完成：`15`
- 进行中：`0`
- 未开始：`27`
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
