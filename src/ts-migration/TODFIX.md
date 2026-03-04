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
