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

---

## Task Checklist（审计任务列表）

### A. 入口与类型层

- [x] **Audit Task 01: `src/ts-migration/index.ts`**
  - 对应原 JS：IIFE 入口装配、全局导出与 `exports.*`。
  - 对应原 d.ts：全局 `LiteGraph` API 聚合导出契约。

- [ ] **Audit Task 02: `src/ts-migration/types/core-types.ts`**
  - 对应原 JS：核心结构约定（节点、槽、widget、菜单）在运行时使用路径。
  - 对应原 d.ts：`Vector*`、`INode*`、`IWidget*`、`IContextMenu*`。

- [ ] **Audit Task 03: `src/ts-migration/types/serialization.ts`**
  - 对应原 JS：`serialize/configure` 数据结构。
  - 对应原 d.ts：`SerializedLLink/SerializedLGraphNode/SerializedLGraphGroup`。

- [ ] **Audit Task 04: `src/ts-migration/types/litegraph-compat.ts`**
  - 对应原 JS：实现与声明差异兼容映射点。
  - 对应原 d.ts：差异 API 的类型对齐策略。

- [ ] **Audit Task 05: `src/ts-migration/types/litegraph-compat.d.ts`**
  - 对应原 JS：兼容补丁可见 API。
  - 对应原 d.ts：补充声明是否无冲突、无破坏。

### B. LiteGraph 核心模块

- [ ] **Audit Task 06: `src/ts-migration/core/litegraph.constants.ts`**
  - 对应原 JS：LiteGraph 常量区、枚举、默认配置。
  - 对应原 d.ts：常量声明、枚举值约束。

- [ ] **Audit Task 07: `src/ts-migration/core/litegraph.constants.compat.ts`**
  - 对应原 JS：`GRID_SHAPE` 等历史常量语义。
  - 对应原 d.ts：`SQUARE_SHAPE` 等命名差异兼容。

- [ ] **Audit Task 08: `src/ts-migration/core/litegraph.registry.ts`**
  - 对应原 JS：`registerNodeType/unregisterNodeType/createNode/getNodeType*`。
  - 对应原 d.ts：LiteGraph 工厂 API 与节点注册契约。

- [ ] **Audit Task 09: `src/ts-migration/core/litegraph.runtime.ts`**
  - 对应原 JS：`isValidConnection/fetchFile/cloneObject/uuidv4/registerSearchboxExtra` 等。
  - 对应原 d.ts：运行时辅助 API 类型契约。

### C. 通用工具与环境兼容

- [ ] **Audit Task 10: `src/ts-migration/utils/math-geometry.ts`**
  - 对应原 JS：`distance/compareObjects/isInside* / growBounding`。
  - 对应原 d.ts：相关工具函数签名。

- [ ] **Audit Task 11: `src/ts-migration/utils/color.ts`**
  - 对应原 JS：`colorToString/hex2num/num2hex`。
  - 对应原 d.ts：颜色工具类型。

- [ ] **Audit Task 12: `src/ts-migration/utils/clamp.ts`**
  - 对应原 JS：`clamp` 实现。
  - 对应原 d.ts：数学工具函数契约。

- [ ] **Audit Task 13: `src/ts-migration/utils/function-signature.ts`**
  - 对应原 JS：`getParameterNames`。
  - 对应原 d.ts：函数签名工具契约。

- [ ] **Audit Task 14: `src/ts-migration/compat/time-source.ts`**
  - 对应原 JS：`getTime` 兼容策略。
  - 对应原 d.ts：时间源函数契约。

- [ ] **Audit Task 15: `src/ts-migration/compat/pointer-events.ts`**
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
- 已完成：`1`
- 进行中：`0`
- 未开始：`41`
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
