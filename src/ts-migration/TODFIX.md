# TS Migration Bug Log (TODFIX)

更新时间：2026-03-04
测试入口：`http://127.0.0.1:5500/editor/index-ts.html`
原始模板对比入口：`http://127.0.0.1:5500/editor/`
工具：Playwright MCP + Browser MCP (Chrome DevTools)

目标：测试入口用户端UI表现接近原始模板对比入口效果

## BUG-001: 选择 Demo 后渲染崩溃 (`n.getBounding is not a function`)

### 问题陈述

- What: 选择顶部 Demo 下拉项（`Features`）后，画布渲染循环抛出 `TypeError: n.getBounding is not a function`。
- When: 在 `index-ts.html` 中切换 Demo（特别是 `Features`）并进入编辑渲染路径时触发。
- Where: `LGraphCanvasMenuPanel.computeVisibleNodes`。
- Impact: 渲染帧报错，Demo 场景无法正常展示，后续交互不稳定。

### 触发步骤（可复现）

1. 打开 `http://127.0.0.1:5500/editor/index-ts.html`。
2. 保持顶部 Demo 下拉默认值 `Empty`（此时基础按钮操作 `Play/Step/Live` 正常）。
3. 在 Demo 下拉中选择 `Features`。
4. 切回编辑渲染路径（`Edit/Live` 切换过程中会稳定触发）。

### 现场证据

- Playwright MCP 控制台错误：
  - `TypeError: n.getBounding is not a function`
  - `at LGraphCanvasMenuPanel.computeVisibleNodes (litegraph.core.ts.js:3521:51)`
  - `at LGraphCanvasMenuPanel.drawFrontCanvas (litegraph.core.ts.js:3656:36)`
  - `at LGraphCanvasMenuPanel.draw (litegraph.core.ts.js:3604:14)`
  - `at renderFrame (litegraph.core.ts.js:2024:52)`
- Browser MCP (Chrome DevTools) 同步复现同栈。
- 运行时检查：`graph._nodes` 中节点为 fallback plain object，`typeof node.getBounding === "undefined"`，`type === null`。

### 5-Whys 根因链

| Level | Why                                                     | Evidence                                                                                                                                        |
| ----- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Why 1 | 为什么会抛 `n.getBounding` 异常？                     | `computeVisibleNodes` 直接调用 `n.getBounding(temp, true)`。                                                                                |
| Why 2 | 为什么会有不满足渲染契约的对象进入 `_nodes`？         | `LGraph` 分层模块读取 host 时固定读取父类静态 `*.liteGraph`，未优先使用运行时构造器 host。                                                  |
| Why 3 | 这会造成什么直接后果？                                  | 在 `configure` 与 `add` 链路中，`createNode/LGraphGroup` 等运行时构造能力解析不稳定。                                                     |
| Why 4 | 为什么 `Group` 会进入 `_nodes` 而不是 `_groups`？ | `isGroupNode` 依赖 `host.LGraphGroup`；当 host 解析不到时退回 `constructor.name==="LGraphGroup"`，但打包后构造器名会被压缩（如 `_d`）。 |
| Why 5 | 为什么会演变成渲染崩溃？                                | `_nodes` 混入了不具备 `getBounding` 的对象，`computeVisibleNodes` 未做契约兜底即直接调用。                                                |

### 代码定位

- `src/ts-migration/canvas/LGraphCanvas.input.ts:1760` (`computeVisibleNodes`)
- `src/ts-migration/canvas/LGraphCanvas.input.ts:1775` (`n.getBounding(temp, true)`)
- `src/ts-migration/models/LGraph.persistence.ts:85` (`createFallbackNode`)
- `src/ts-migration/models/LGraph.persistence.ts:248-260` (`host.createNode` 失败后回退)

### 建议修复（按优先级）

1. **P0（已完成）**：统一 `LGraph` 分层 host 解析为“运行时构造器优先”
   - 已修复：`LGraph.persistence.ts`、`LGraph.structure.ts`、`LGraph.io-events.ts`、`LGraph.execution.ts`、`LGraph.lifecycle.ts`。
   - 策略：`this.constructor.liteGraph -> 当前层 class.liteGraph -> 父层 class.liteGraph -> defaultHost`。
2. **P1（可选增强）**：fallback 节点补最小渲染契约
   - 当未知类型节点仍需加载时，建议补 `getBounding/computeSize/getConnectionPos` 占位实现，进一步避免渲染中断。
3. **P1（可观测性）**：fallback 节点一次性告警
   - 输出缺失类型、原始 `nInfo.type`、来源图数据，便于定位注册缺口。
4. **P2（回归门禁）**：增加 demo 切换 E2E
   - 场景：`Empty -> Features`，断言无 `TypeError` 且 `_nodes` 全部具备 `getBounding`。

### 修复进展（2026-03-04）

- 代码变更
  - `src/ts-migration/models/LGraph.persistence.ts`：`getPersistenceHost()` 改为运行时构造器优先。
  - `src/ts-migration/models/LGraph.structure.ts`：`getStructureHost()` 改为运行时构造器优先。
  - `src/ts-migration/models/LGraph.io-events.ts`：`getIOEventsHost()` 改为运行时构造器优先。
  - `src/ts-migration/models/LGraph.execution.ts`：`getExecutionHost()` 改为运行时构造器优先。
  - `src/ts-migration/models/LGraph.lifecycle.ts`：新增 `getLifecycleHost()` 并替换直接 `LGraph.liteGraph` 访问。
- 构建结果
  - `node scripts/build-ts-migration.mjs`：成功生成 `dist/litegraph.core.ts.js` 与 `dist/litegraph.core.ts.min.js`。
- 验证结果（Playwright MCP + Browser MCP）
  - 入口：`http://127.0.0.1:5500/editor/index-ts.html`
  - 操作：切换 Demo 到 `Features`，执行 `Play/Step/Live` 核心操作。
  - 结果：控制台 `error=0`，未再出现 `n.getBounding is not a function`。
  - 运行时断言：`nodes=10`，`groups=1`，`badNodes=0`，`groupInNodes=0`。

### 当前状态

- 状态：`Fixed`（已修复并验证）
- 严重级别：`High`（历史影响）
- 回归风险：`中`（建议追加 demo 切换门禁用例）

---

## E2E 对标基线（提炼自 `tests/playwright`）

用途：后续每次对比 `index.html`（源版）与 `index-ts.html`（TS 迁移版）时，统一按这份清单记录差异与回归 bug。

### 对标范围（按能力域）

| 能力域 | 标准 spec | 关键断言（应至少满足） |
|---|---|---|
| 工具栏与快捷键 | `tests/playwright/specs/toolbar-and-shortcuts.spec.cjs` | `Play/Step/Live/Maximize` 可用；`Ctrl+A/C/V/Shift+V/Delete` 生效；空格拖拽可平移画布 |
| 连接与断开 | `tests/playwright/specs/connection-disconnection.spec.cjs` | 连接、替换连接、拖拽断开、slot 菜单断开、link 菜单删除均能改变图状态 |
| 面板与搜索框 | `tests/playwright/specs/panel-searchbox.spec.cjs` | SearchBox 创建节点、类型过滤、Node Panel 重命名/删除可闭环 |
| 分组生命周期 | `tests/playwright/specs/group-lifecycle.spec.cjs` | 创建/移动/重命名/删除分组，组内节点联动正确 |
| 节点高级菜单与子图 | `tests/playwright/specs/node-advanced-menu-and-subgraph.spec.cjs` | `Collapse/Pin/Colors/Shapes/Clone/Remove/To Subgraph/Open/Close` 全路径有效 |
| UI 输入事件传播 | `tests/playwright/specs/ui-input-event-propagation.spec.cjs` | 左键/右键/双击/拖拽/滚轮/上下文菜单链路稳定，无 runtime error |
| 运行时事件传播 | `tests/playwright/specs/runtime-event-propagation.spec.cjs` | `trigger/sequence/timer/waitAll/delay/once` 链路触发与状态变化正确 |
| 节点模式矩阵 | `tests/playwright/specs/node-mode-matrix.spec.cjs` | `Always/On Event/Never/On Trigger` 模式切换与执行路径可触达 |
| 上下文菜单递归覆盖 | `tests/playwright/specs/context-menu-recursive.spec.cjs` | canvas/node/slot/link 四类菜单可遍历；核心 token 命中 |
| 核心能力门禁 | `tests/playwright/specs/ui-core-coverage-guard.spec.cjs` | `Add Node/Add Group/Search/Mode/Collapse/Pin/Clone/Remove/Delete link/To Subgraph/Close subgraph` 至少命中一次 |
| 迁移兼容守卫 | `tests/playwright/specs/migration-compat-guard.spec.cjs` | 静态兼容 API、对齐菜单、子图路径、属性可读值路径全部通过 |
| 迁移 UI 关键路径 | `tests/playwright/specs/migration-ui-keypaths.spec.cjs` | 菜单对齐、子图转换、属性 printable 路径全部通过 |
| 全量静态节点冒烟 | `tests/playwright/specs/all-nodes-smoke.spec.cjs` | static manifest 节点可创建/调用/模式切换（按白名单处理环境依赖失败） |
| 全流程闭环与报告 | `tests/playwright/specs/full-normal-usage.spec.cjs` | 生成 node/feature/event coverage 报告，且 feature/event 不失败 |
| TODO 修复回归集 | `tests/playwright/specs/todo-fix-phase-a.spec.cjs` | Phase-A 5 条用户影响项持续通过 |
| 生命周期闭环（旧基准） | `tests/playwright/specs/full-lifecycle-closure.spec.cjs` | 菜单创建节点、编辑 widget、连线、菜单删除形成最小闭环 |
| 核心交互综合（旧基准） | `tests/playwright/specs/interactions-core.spec.cjs` | 节点移动/重命名/连接断开/widget/删除 + 画布平移缩放坐标回环 |
| 可点击区域扫描（旧基准） | `tests/playwright/specs/self-aware-scan.spec.cjs` | 动态提取 clickable regions 并可交互，不破坏图恢复能力 |

### 当前基线值（2026-03-04）

来源：`tests/playwright/reports/*`

| 报告 | 基线值 | 说明 |
|---|---|---|
| `ui-core-coverage-guard.json` | `11/11` 通过 | 核心 UI 能力门禁全绿 |
| `migration-compat-guard-report.json` | `4/4` 通过 | 迁移兼容关键 API/路径全绿 |
| `migration-ui-keypaths-report.json` | `3/3` 通过 | 迁移 UI 关键路径全绿 |
| `context-menu-recursive-report.json` | `totalLeafCount=228`，`requiredHits=6/6` | 菜单覆盖达到预算并命中核心项 |
| `feature-coverage.json` | `records=4`，`failures=0` | 特性闭环全绿 |
| `event-coverage.json` | `records=2`，`failures=0` | 事件链路全绿 |
| `node-coverage.json` | `records=207`，`failures=13` | 静态节点冒烟存在环境依赖失败白名单（见下） |

### 已知白名单（静态节点环境依赖失败）

当前 `node-coverage.json` 中的 13 项失败，默认视为环境依赖/能力缺失导致，不作为 TS 回归判定，除非数量上升或出现新类型。

1. `shader::`
2. `audio/waveShaper`
3. `fx/DOF`
4. `fx/lens`
5. `fx/vigneting`
6. `geometry/displace`
7. `geometry/render_dof`
8. `texture/clustered_operation`
9. `texture/edges`
10. `texture/encode`
11. `texture/gradient`
12. `texture/LUT`
13. `texture/textureChannels`

### TS 对比记录模板（每轮填写）

| 轮次/日期 | 入口 | 运行命令 | 总体结果 | 新增失败 | 关闭失败 | 关联 BUG |
|---|---|---|---|---|---|---|
| 示例：R1 / 2026-03-04 | `index-ts.html` | `npx playwright test --project=chromium --grep @core` | 通过 | 0 | 0 | - |

### 建议执行顺序（用于差异定位）

1. 先跑核心门禁：`npx playwright test --project=chromium --grep @core`
2. 再跑迁移守卫：`migration-compat-guard.spec.cjs` 与 `migration-ui-keypaths.spec.cjs`
3. 再跑高成本覆盖：`all-nodes-smoke.spec.cjs` + `full-normal-usage.spec.cjs`
4. 将结果写回本文件，并为每个新增失败创建 `BUG-xxx` 条目（包含复现步骤、栈、根因、修复状态）

### 入口切换说明（源版 vs TS 版）

当前 fixture 默认入口是 `/editor/index.html`。  
要对比 TS 版，请在执行前切换入口到 `/editor/index-ts.html`（建议后续给 `gotoEditor()` 增加可配置入口参数，避免手改）。
