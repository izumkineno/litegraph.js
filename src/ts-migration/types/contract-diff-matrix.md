# LiteGraph JS vs d.ts Contract Diff Matrix

本文档用于落地 `src/litegraph.js` 与 `src/litegraph.d.ts` 的契约差异矩阵，对应迁移计划 **Task 36**。
矩阵项与以下两个文件保持一一对应：

- `src/ts-migration/types/litegraph-compat.ts` 中 `LITEGRAPH_API_DIFF_MATRIX`
- `src/ts-migration/types/litegraph-compat.d.ts` 中 `LiteGraphCompatDiffId`

## Matrix

| ID | Area | d.ts 契约 | JS 运行时 | 证据定位 | 兼容策略 | 后续收敛任务 |
| --- | --- | --- | --- | --- | --- | --- |
| `constants.grid-square-alias` | constants | `LiteGraph.SQUARE_SHAPE = 6` | `LiteGraph.GRID_SHAPE = 6` | d.ts: `src/litegraph.d.ts:184`；JS: `src/litegraph.js:59` | 常量双向别名，统一同值 `6` | Task 37 |
| `canvas-static.resize` | canvas-static | `LGraphCanvas.onResizeNode` | `LGraphCanvas.onMenuResizeNode` | d.ts: `src/litegraph.d.ts:1128`；JS: `src/litegraph.js:11128` | 静态方法双向别名映射 | Task 42 |
| `canvas-static.subgraph-menu` | canvas-static | d.ts 未声明 `onMenuNodeToSubgraph` | JS 存在 `onMenuNodeToSubgraph` | JS: `src/litegraph.js:13366`，菜单挂载 `src/litegraph.js:13578` | 声明层补别名 `onNodeToSubgraph`，运行时映射 | Task 42 |
| `canvas-instance.deselected` | canvas-instance | `LGraphCanvas.prototype.processNodeDeselected` | 同名实现缺失（由其他路径间接处理） | d.ts: `src/litegraph.d.ts:1336` | 原型 shim：回退到 `deselectNode` | Task 42 |
| `canvas-instance.slot-graphic` | canvas-instance | `LGraphCanvas.prototype.drawSlotGraphic` | 同名实现缺失 | d.ts: `src/litegraph.d.ts:1370` | 原型 shim：提供 no-op 兜底 | Task 42 |
| `canvas-instance.touch-handler` | canvas-instance | `LGraphCanvas.prototype.touchHandler` | 实现被注释/不可用 | d.ts: `src/litegraph.d.ts:1441`；JS 注释块: `src/litegraph.js:10586` | 原型 shim：提供 no-op 兜底 | Task 42 |
| `serialization.link-tuple-order` | serialization | `SerializedLLink = [id,type,origin_id,origin_slot,target_id,target_slot]` | 运行时 `LLink.serialize() = [id,origin_id,origin_slot,target_id,target_slot,type]` | d.ts: `src/litegraph.d.ts:561`；JS: `src/litegraph.js:2464` | 输入双格式归一化，输出支持 runtime/d.ts 双顺序 | Task 38 |
| `serialization.group-font-field` | serialization | `SerializedLGraphGroup.font` | `LGraphGroup.serialize().font_size` / `configure(o.font_size)` | d.ts: `src/litegraph.d.ts:1049,1055`；JS: `src/litegraph.js:5099,5113` | 输入兼容 `font/font_size`，统一到 runtime `font_size` | Task 39 |
| `ui.close-all-context-menus` | ui | `ContextMenu.closeAllContextMenus(window)` | `LiteGraph.closeAllContextMenus(ref_window)` | d.ts: `src/litegraph.d.ts:1483`；JS: `src/litegraph.js:14319` | 双入口挂载同一函数引用 | Task 40 |
| `graph-hooks.on-node-added` | graph-hooks | `LGraph.onNodeAdded(node)` 契约存在 | JS 以可选回调方式调用（非强定义） | d.ts: `src/litegraph.d.ts:457`；JS 调用点: `src/litegraph.js:1586-1587` | helper 安全触发，保持可选钩子语义 | Task 41 |
| `canvas-static.missing-apis` | canvas-static | d.ts 缺失部分静态能力声明 | JS 存在 `getBoundaryNodes/alignNodes/onNodeAlign/onGroupAlign/getPropertyPrintableValue` | JS: `src/litegraph.js:10657,10702,10741,10753,12771` | 声明补齐 + 存在性守卫 + E2E 回归 | Task 42, Task 44 |

## Notes

1. 本矩阵只覆盖“声明与运行时不一致”的契约项，不重复记录完全一致项。
2. `SerializedLLink` 与 `SerializedLGraphGroup` 是已验证的高风险差异，分别由 Task 33（测试）和 Task 38/39（实现收敛）闭环。
3. UI 静态能力差异项（align/property printable/subgraph menu）已由 Task 34 覆盖关键回归路径，完整兼容模式回归在 Task 44 收敛。
