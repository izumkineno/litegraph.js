# `litegraph.js` TODO 修复计划（用户影响优先）

## 简要结论

按你刚选的范围“先修用户影响项”，本计划分两阶段：

1. 第一阶段先落地 13 项用户可感知/稳定性 TODO。
2. 第二阶段收敛 10 项重构与扩展型 TODO。

基线文件：

- [litegraph.js](E:/Code/litegraph.js/src/litegraph.js)
- [Migration_Plan_and_Progress.md](E:/Code/litegraph.js/guides/Migration_Plan_and_Progress.md)

## TODO 清单（作用、修复位置、用户验证）

| #  | TODO 位置  | 这个 TODO 的作用                                   | 需要修复到哪里                                                                              | 优先级 | 用户端怎么验证                                                                               |
| -- | ---------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------- |
| 1  | `L111`   | 控制 dialog 是否鼠标离开自动关闭                   | `LGraphCanvas.prototype.createDialog`（`L12209+`）统一关闭策略                          | P1     | 打开属性弹窗，`dialog_close_on_mouse_leave=false` 时移出不自动关；点画布空白关闭；ESC 可关 |
| 2  | `L114`   | 连接线断开快捷键策略（Shift/Alt）                  | `LGraphCanvas.prototype.processMouseDown` 输出槽分支（`L6075+`）                        | P1     | 开启 `shift_click_do_break_link_from` 后，按修复后的快捷键点输出槽可断线；未按键不误断     |
| 3  | `L117`   | 搜索框离开关闭策略                                 | `LGraphCanvas.prototype.showSearchBox`（`L11508+`）补“非 leave 场景关闭”              | P1     | 搜索框在 `hide_on_mouse_leave=false` 时，点击外部可关闭；`true` 时离开 500ms 关闭        |
| 4  | `L142`   | 指针事件完整性（cancel/capture）                   | `LiteGraph.pointerListenerAdd/Remove`（`L14309+`）+ `bindEvents/unbindEvents`         | P1     | 拖拽中触发 `pointercancel` 后不再“卡住拖拽”                                              |
| 5  | `L249`   | 注册节点时自动收集输入输出槽类型                   | `LiteGraph.registerNodeType`（`L157+`）调用 `registerNodeAndSlotType`                 | P1     | 注册自定义节点后，搜索框类型过滤下拉能看到新槽类型                                           |
| 6  | `L1728`  | 节点重叠时应命中“最上层”节点                     | `LGraph.prototype.getNodeOnPos`（`L1722+`）命中优先级逻辑                               | P1     | 两节点重叠，点击重叠区总是选中顶层节点                                                       |
| 7  | `L2372`  | 节点 trace 的图级分发钩子                          | `LGraph.prototype.onNodeTrace`（`L2371+`）实现默认分发/回调                             | P2     | 自定义 `graph.onNodeTrace` 可收到 `node.trace()` 消息                                    |
| 8  | `L4048`  | 合并重复 slot 查找逻辑，降低维护成本               | `findInputSlot*`/`findOutputSlot*` 一组（`L4016+`）抽公共 helper                      | P2     | 所有 `find*` 行为与修复前一致（回归单测）                                                  |
| 9  | `L4224`  | `connectByType` 失败时过滤策略扩展               | `LGraphNode.prototype.connectByType`（`L4185+`）补 `opts.filter`                      | P2     | 指定过滤规则后，仅连接允许槽位                                                               |
| 10 | `L4278`  | `connectByTypeOutput` 失败时过滤策略扩展         | `LGraphNode.prototype.connectByTypeOutput`（`L4238+`）补 `opts.filter`                | P2     | 指定过滤规则后，仅连接允许输出槽                                                             |
| 11 | `L5719`  | 触摸事件链路缺失                                   | `LGraphCanvas.prototype.bindEvents/unbindEvents`（`L5700+`/`L5765+`）                 | P1     | 移动端/触摸模拟下可拖节点、平移画布、连线                                                    |
| 12 | `L6384`  | 选择变化通知逻辑缺失                               | `LGraphCanvas.prototype.processMouseDown`（`L5926+`）补 selection diff 回调             | P2     | 选中节点变化时回调只触发一次，不重复抖动                                                     |
| 13 | `L7200`  | 键盘扩展（节点键盘钩子/折叠快捷）占位              | `LGraphCanvas.prototype.processKey`（`L7141+`）补快捷键与消费机制                       | P1     | 选中节点后快捷键触发预期动作；节点 `onKeyDown` 返回消费时不冒泡                            |
| 14 | `L9129`  | 颜色非法导致 `addColorStop` DOMException         | `LGraphCanvas.prototype.drawNode`（`L8539+`）加颜色校验与降级                           | P1     | 节点传非法 `title_color` 不崩溃，使用默认色继续渲染                                        |
| 15 | `L11169` | “中间插入节点”链路未完成                         | `createDefaultNodeForSlot`（`L11031+`）补 from->new->to 双向插入                        | P2     | 给定 from/to 两端参数时，新节点插入并两段连线建立                                            |
| 16 | `L11291` | 属性编辑器路径不统一（title vs property）          | `LGraphCanvas.onShowPropertyEditor`（`L11292+`）统一调用对话框层                        | P2     | 编辑 Title 与属性字段行为一致（保存/取消/ESC）                                               |
| 17 | `L11297` | 属性编辑器未复用 `createDialog`                  | 同上，改为复用 `createDialog`                                                             | P2     | 对话框样式、关闭行为、键盘行为一致                                                           |
| 18 | `L11513` | 类型过滤开关未判断 slot 类型注册是否为空           | `showSearchBox` 默认参数构建（`L11509+`）前置 guard                                     | P1     | 未注册 slot 类型时不展示无意义过滤器；注册后正常展示                                         |
| 19 | `L12208` | 多套 dialog 创建逻辑分裂                           | `createDialog/prompt/onShowPropertyEditor/showEditPropertyValue` 统一                     | P2     | 所有输入弹窗在关闭、焦点、修改态上行为一致                                                   |
| 20 | `L13310` | `To Subgraph` 菜单被硬编码禁用                   | `getNodeMenuOptions`（`L13221+`）移除 `if(0)`，改可控条件                             | P1     | 右键节点可见 `To Subgraph`，点击可转换且可回退                                             |
| 21 | `L13777` | ContextMenu leave-close 需按设备分流               | `ContextMenu` 构造（`L13662+`）补设备检测+桌面关闭逻辑                                  | P1     | 桌面移出菜单自动关闭；触摸设备不误关                                                         |
| 22 | `L13998` | 菜单关闭生命周期事件未实现                         | `ContextMenu.prototype.close`（`L13974+`）增加关闭钩子                                  | P2     | 注册关闭钩子后，每次菜单关闭都会收到通知                                                     |
| 23 | `L14318` | pointer->touch fallback “在建中”且分支可重复绑定 | `pointerListenerAdd/Remove`（`L14309+`）重写事件映射表并消除 switch fall-through 副作用 | P1     | 同一事件不会重复绑定；pointer 不可用时 touch 映射可用                                        |

## 分阶段实施（决策已锁定）

1. 阶段 A（本轮必须完成，P1）
2. 覆盖 TODO：`1,2,3,4,5,6,11,13,14,18,20,21,23`
3. 目标：用户可见行为稳定，编辑器交互无明显坑点
4. 交付：交互链路修复 + 回归测试 + 文档更新
5. 阶段 B（下一轮，P2）
6. 覆盖 TODO：`7,8,9,10,12,15,16,17,19,22`
7. 目标：重构收敛、可扩展性与一致性
8. 交付：内部抽象重整 + 兼容钩子 + 单测补齐

## 重要 API/类型影响（不破坏兼容）

1. 不移除现有公开 API，不改函数签名的必填参数。
2. 允许新增“可选”配置/钩子（非 breaking）：
3. 菜单关闭生命周期钩子（用于 `L13998`）。
4. 键盘/断线修饰键内部策略（默认保持旧行为）。
5. 触摸与 pointer fallback 仅补全，不改变默认 `pointerevents_method` 的可用值。
6. 对外表现要求：现有 demos、Playwright `@core` 不回归。

## 测试与用户验证方案

1. 自动化回归
2. `npx playwright test --project=chromium --grep "@core"`
3. 新增 `@todo-fix` 标签用例，覆盖上表 P1 条目
4. 每次阶段提交前执行 3 轮连续重跑，确认无随机失败
5. 手工验证（用户端）
6. 右键菜单：`To Subgraph` 可见、可执行、可返回
7. 搜索框：过滤器仅在类型已注册时显示
8. 弹窗：离开/外点/ESC 关闭策略符合配置
9. 输入事件：鼠标、触摸、pointercancel 不会卡状态
10. 渲染鲁棒性：非法颜色不导致画布异常

## 验收标准

1. 阶段 A 的 13 个 P1 TODO 全部关闭并有对应测试。
2. UI 核心链路（菜单、搜索、拖拽、连线、子图）在 chromium 下稳定通过。
3. 无新增 breaking API，现有脚本/示例可继续运行。
4. 每个 TODO 都有“作用-修复位置-用户验证”闭环记录。

## 假设与默认

1. 本计划覆盖的是 `src/litegraph.js` 当前识别的 23 条 TODO/UNDER CONSTRUCTION 标记。
2. 优先修复用户影响项，重构型 TODO 下一阶段收敛。
3. 原始 `src/litegraph.js` 的历史行为以“尽量兼容”为第一原则，除明显 bug 外不主动改交互习惯。
