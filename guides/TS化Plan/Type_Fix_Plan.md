# Type Fix Plan

## 输入日志与范围
- 日志来源：本地执行 `npx tsc --noEmit --strict src/ts-migration/index.ts`
- 统计结果：`115` 条错误，涉及 `15` 个文件
- 说明：你的消息里没有粘贴 `tsc` 原始日志，因此本计划基于当前仓库可复现日志生成

## 错误分类（按类型类别）

1. `null/undefined` 可空性问题（最高占比）
- 错误码：`TS2531 / TS2532 / TS18047 / TS18048`
- 数量：`50`
- 典型场景：DOM/canvas 可能为 `null`、可选方法直接调用、可选对象链未收敛

2. 类型不兼容/参数签名不匹配
- 错误码：`TS2322 / TS2345 / TS2769 / TS2416 / TS2430`
- 数量：`38`
- 典型场景：事件监听签名不匹配、构造签名不协变、子类方法签名与基类冲突

3. 可选方法直接调用（未收窄）
- 错误码：`TS2722`
- 数量：`14`
- 典型场景：`findInputSlotByType/findOutputSlotByType/connect` 等可能为 `undefined`

4. `this` / 隐式 any / 索引访问
- 错误码：`TS2683 / TS7053 / TS7015 / TS7022`
- 数量：`12`
- 典型场景：回调中 `this` 未标注、联合类型索引、局部变量推断回路

5. 属性声明/结构约束不一致
- 错误码：`TS2353 / TS2425 / TS2339`
- 数量：`11`
- 典型场景：对象字面量含未声明字段、父子类成员类型冲突、`never` 推断导致 API 不可用

## 文件级概览（按错误数量）
- `src/ts-migration/models/LGraphNode.connect-geometry.ts`: `23`
- `src/ts-migration/canvas/LGraphCanvas.render.ts`: `18`
- `src/ts-migration/canvas/LGraphCanvas.menu-panel.ts`: `16`
- `src/ts-migration/canvas/LGraphCanvas.input.ts`: `12`
- `src/ts-migration/ui/ContextMenu.ts`: `12`
- `src/ts-migration/index.ts`: `9`
- `src/ts-migration/ui/CurveEditor.ts`: `8`
- `src/ts-migration/canvas/LGraphCanvas.static.ts`: `7`
- `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts`: `2`
- `src/ts-migration/models/LGraphNode.execution.ts`: `2`
- `src/ts-migration/models/LGraphNode.state.ts`: `2`
- `src/ts-migration/canvas/DragAndScale.ts`: `1`
- `src/ts-migration/compat/pointer-events.ts`: `1`
- `src/ts-migration/models/LGraph.persistence.ts`: `1`
- `src/ts-migration/models/LGraphNode.canvas-collab.ts`: `1`

## 修复优先级策略
- `P0（核心模型层）`：Graph / Node 数据结构与执行链，先修复以产生向下收益
- `P1（入口与兼容层）`：`index.ts`、事件/指针兼容，打通类型装配
- `P2（Canvas 交互层）`：input/menu/render/static/lifecycle
- `P3（UI 组件层）`：`ContextMenu`、`CurveEditor`

## Task Checklist（按文件顺序，核心优先）

- [x] **Task 1 (P0): `src/ts-migration/models/LGraphNode.connect-geometry.ts`**
  - 报错类型：`TS2722 x14`, `TS18048 x6`, `TS2353 x2`, `TS2425 x1`
  - 修复目标：
    - 为 `findInputSlotByType/findOutputSlotByType/findInputSlotFree/findOutputSlotFree/connect` 建立稳定接口（可调用前强制收窄）
    - 调整 `INodeInputSlot/INodeOutputSlot` 扩展字段（`optional`）的类型来源，避免裸字面量越界
    - 统一 `onAfterExecuteNode` 在继承链中的定义方式（属性或方法二选一）
  - 预期收益：连接逻辑类型稳定，消除大量调用侧可选性告警

- [x] **Task 2 (P0): `src/ts-migration/models/LGraphNode.state.ts`**
  - 报错类型：`TS2531 x1`, `TS7022 x1`
  - 修复目标：
    - 显式标注 `widget` 局部变量类型，解除自引用推断回路
    - 对 `graph/widgets` 可空路径做最小收窄
  - 预期收益：节点基础状态类型稳定，支撑 execution/ports 层

- [x] **Task 3 (P0): `src/ts-migration/models/LGraphNode.execution.ts`**
  - 报错类型：`TS2531 x1`, `TS18047 x1`
  - 修复目标：
    - 对 `graph` 访问链做守卫（执行前确保 graph 非空）
    - 清理 `null` 路径下的输出分支
  - 预期收益：执行流类型安全，减少运行期空引用风险

- [x] **Task 4 (P0): `src/ts-migration/models/LGraphNode.canvas-collab.ts`**
  - 报错类型：`TS2532 x1`
  - 修复目标：
    - 补齐可选成员访问收窄，避免 `undefined` 路径直接读写

- [x] **Task 5 (P0): `src/ts-migration/models/LGraph.persistence.ts`**
  - 报错类型：`TS2416 x1`
  - 修复目标：
    - 对齐 `configure` 的继承签名（参数协变/逆变一致）
    - 保持基类契约不被破坏
  - 预期收益：Graph 序列化接口成为全局稳定类型边界

- [x] **Task 6 (P1): `src/ts-migration/index.ts`**
  - 报错类型：`TS2322 x9`
  - 修复目标：
    - 调整 `UnknownCtor`/构造签名约束，允许实际构造器参数列表
    - 解除装配层 `bundle` 与 `global bridge` 的构造签名冲突
  - 预期收益：入口装配类型打通，减少后续模块级连锁报错

- [x] **Task 7 (P1): `src/ts-migration/compat/pointer-events.ts`**
  - 报错类型：`TS2322 x1`
  - 修复目标：
    - 统一 `ListenerFn` 事件参数联合签名（`Event | TouchNormalizedEvent`）

- [x] **Task 8 (P2): `src/ts-migration/canvas/LGraphCanvas.input.ts`**
  - 报错类型：`TS2345 x6`, `TS7053 x2`, `TS18048 x2`, `TS2322 x1`, `TS7015 x1`
  - 修复目标：
    - 为 `canvas`、`pointer listener` 增加非空守卫
    - 收窄 `false | Vector2` 联合后再索引
    - 修复索引类型（number/string）
  - 预期收益：输入链路告警显著下降

- [x] **Task 9 (P2): `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts`**
  - 报错类型：`TS2339 x2`
  - 修复目标：
    - 修正 `never` 推断来源，保证事件目标类型为 `EventTarget`

- [x] **Task 10 (P2): `src/ts-migration/canvas/LGraphCanvas.static.ts`**
  - 报错类型：`TS18047 x5`, `TS2322 x1`, `TS2345 x1`
  - 修复目标：
    - `canvas/subgraph_node` 空值收窄
    - 修正 `string | undefined` 到目标类型的映射

- [x] **Task 11 (P2): `src/ts-migration/canvas/LGraphCanvas.menu-panel.ts`**
  - 报错类型：`TS2531 x12`, `TS18047 x1`, `TS2345 x1`, `TS2322 x1`, `TS2769 x1`
  - 修复目标：
    - 统一菜单面板 DOM 引用可空收窄策略
    - 事件监听参数改为 `EventListener` 兼容签名
    - `keydown` 监听目标类型从 `ElementEventMap` 约束中解耦

- [x] **Task 12 (P2): `src/ts-migration/canvas/LGraphCanvas.render.ts`**
  - 报错类型：`TS2683 x8`, `TS18047 x4`, `TS2322 x3`, `TS2531 x2`, `TS2345 x1`
  - 修复目标：
    - 为回调函数显式声明 `this` 类型或改为箭头函数
    - 收窄 `values_list`、ctx 引用可空路径
    - 修正 `fillStyle` 等 Canvas API 赋值类型

- [x] **Task 13 (P2): `src/ts-migration/canvas/DragAndScale.ts`**
  - 报错类型：`TS2339 x1`
  - 修复目标：
    - 修正事件目标推断，避免 `never` 导致 `addEventListener` 不可见

- [x] **Task 14 (P3): `src/ts-migration/ui/ContextMenu.ts`**
  - 报错类型：`TS18048 x6`, `TS2345 x2`, `TS2352 x2`, `TS2430 x1`, `TS2339 x1`
  - 修复目标：
    - 对齐 `ContextMenuOptions` 与 `IContextMenuOptions`（`Boolean` -> `boolean`、callback 参数一致）
    - DOM 事件监听签名统一为兼容的 `EventListener`
    - `options` 可选路径做集中收窄

- [x] **Task 15 (P3): `src/ts-migration/ui/CurveEditor.ts`**
  - 报错类型：`TS2531 x8`
  - 修复目标：
    - 对 `ctx`/canvas 相关引用做非空守卫与早返回

## 建议执行顺序（两轮）
1. 第一轮（打通核心类型边界）：`Task 1 -> 2 -> 3 -> 5 -> 6 -> 7`
2. 第二轮（收敛 UI/Canvas 可空性与事件签名）：`Task 8 -> 9 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15`

## 每轮验收标准
- 命令：`npx tsc --noEmit --strict src/ts-migration/index.ts`
- 通过标准：
  - 第一轮结束后：核心模型层（`models/*` + `index.ts`）错误清零
  - 第二轮结束后：总错误数持续下降并最终清零
