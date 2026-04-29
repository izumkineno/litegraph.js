# TS Migration 问题清单

本文记录 `src/ts-migration/` 当前仍需要维护者关注的问题。它不是迁移计划，也不记录任务进度；只保留长期有用的问题、证据、影响和建议。

## 快照

- 检查日期：2026-04-29
- 范围：`src/ts-migration/**/*.ts`、迁移相关测试、构建脚本
- TypeScript：`bun run typecheck` 通过
- TS migration bundle：`bun run build:ts-migration` 通过
- Jest：当前 10/12 suites 通过；2 个旧入口相关 suite 失败
- ESLint：当前配置没有覆盖 `src/ts-migration/**/*.ts`，直接 lint `src/ts-migration` 会提示没有匹配配置

## P0 — 旧运行时入口缺失导致 parity 测试失败

**证据**

- `tests/litegraph.test.js` 依赖 `require("../src/litegraph")`。
- `tests/migration-parity/serialization.test.ts` 依赖 `require("../../src/litegraph")` 作为旧实现对照。
- 当前工作区缺少 `src/litegraph.js` 时，`bun run test` 中这两个 suite 失败。

**影响**

- 迁移层本身的单元测试可以运行，但旧运行时对照测试无法完成。
- 序列化 parity 的回归证据不完整。
- 发布前无法用完整 test suite 证明迁移层仍兼容旧实现。

**建议**

- 明确旧运行时入口的权威位置。
- 如果旧实现被移动，应同步更新 parity 测试加载路径和 package/types 路径。
- 在修复前，报告测试结果时要区分“ts-migration 单元测试通过”和“旧入口 parity 失败”。

## P1 — TypeScript lint 未覆盖迁移层

**证据**

- `eslint.config.js` 当前主要匹配 `src/**/*.js`、`editor/**/*.js`、`tests/**/*.js` 和 `scripts/**/*.mjs`。
- 直接执行 `bunx eslint src/ts-migration` 会提示该路径没有匹配配置或被忽略。

**影响**

- `src/ts-migration/**/*.ts` 中的风格、复杂度、未使用变量、显式 `any` 等问题不会被 lint gate 捕获。
- typecheck 只能证明类型可编译，不能替代代码质量检查。

**建议**

- 为 `src/ts-migration/**/*.ts` 增加 ESLint flat config 覆盖。
- 初期可以只启用低风险规则，避免一次性引入大量阻塞。
- 将 `explicit-any`、未使用变量、空块、console 输出按阶段收敛。

## P1 — `any` 与 `as any` 仍集中在 canvas/services/ui 边界

**证据**

扫描 `src/ts-migration/**/*.ts`：

| 项 | 数量 | 热点 |
| --- | ---: | --- |
| `any` | 359 | `LGraphCanvas.input.ts`、`LGraphCanvas.render.ts`、`menu-panel-types.ts`、`LGraphCanvas.menu-panel.ts` |
| `as any` | 98 | `LGraphCanvas.input.ts`、`LGraphCanvas.render.ts`、`ContextMenu.ts`、`LGraphCanvas.menu-panel.ts` |

**影响**

- canvas/input/render 这些高频核心路径的真实契约仍不清晰。
- services 和 menu 类型容易变成“宽口袋”，削弱 `contracts/` 的边界价值。
- 后续重构时，类型系统难以及时发现跨层字段漂移。

**建议**

- 不做全量去 `any`；先从 `menu-panel-types.ts`、`contracts/canvas.ts`、`contracts/ui.ts` 收紧跨层 port。
- 对 input/render 中重复出现的 node/link/widget 结构建立最小局部类型。
- 每次收紧类型都要跑 `typecheck` 和相关 migration-unit 测试。

## P1 — 高频 canvas 文件仍然过大

**证据**

- `canvas/LGraphCanvas.render.ts` 约 90 KB。
- `canvas/LGraphCanvas.input.ts` 约 73 KB。
- `canvas/LGraphCanvas.static.ts` 约 43 KB。
- `canvas/LGraphCanvas.lifecycle.ts` 约 34 KB。

**影响**

- 输入、渲染、状态切换、命中测试等热路径仍集中在少数大类文件中。
- 修改 UI 行为时容易误触渲染或输入路径。
- 性能排查时难以隔离对象分配、坐标换算和 DOM 操作。

**建议**

- 优先抽离纯函数：命中测试、link path 计算、widget 绘制辅助、dirty 区域判断。
- 冷路径继续下沉到 `services/`，不要回流到 canvas 主链。
- 每次拆分必须保持旧 API 方法名与调用时机不变。

## P1 — 兼容信息仍有多份真相风险

**证据**

- 运行时差异矩阵：`types/litegraph-compat.ts`
- 声明侧差异：`types/litegraph-compat.d.ts`
- 人类可读说明：`types/contract-diff-matrix.md`
- 相关行为测试：`tests/migration-unit/litegraph-compat.test.ts`、serialization/group/link compat 测试

**影响**

- 新增兼容项时可能只更新其中一处。
- 文档、声明和运行时代码可能漂移。

**建议**

- 将 `litegraph-compat.ts` 视为主要事实来源。
- 文档和 `.d.ts` 的更新应在同一 diff 中完成。
- 为新增差异项补最小单元测试。

## P2 — TODO 与调试输出仍需收口

**证据**

- `TODO/FIXME/HACK/XXX` 命中 4 处：`ContextMenu.ts`、`connection-menu-controller.ts`、`LGraph.persistence.ts`、`LGraphCanvas.static.ts`。
- `console.log` 命中 18 处，分布在 registry/runtime、graph/node 模型与连接几何等文件。

**影响**

- TODO 如果没有归属和验收条件，会变成长期噪声。
- 调试输出可能污染使用者控制台，且缺少统一 logger 策略。

**建议**

- 保留必要兼容警告，但区分 warning/error/debug。
- 普通调试日志改为可开关 logger 或删除。
- 每个 TODO 要么落入本问题清单，要么补充原因和条件。

## P2 — `persistence` 同时承担序列化与修补职责

**证据**

- `models/LGraph.persistence.ts` 同时处理 graph 序列化/反序列化、link 移除、fallback 节点构造和旧数据容错。

**影响**

- 数据模型层与迁移修补策略耦合。
- 未来收敛序列化契约时，该文件会成为风险集中点。

**建议**

- 把旧数据 normalize/repair 逻辑抽成独立 helper 或 compat 模块。
- 保持 `LGraph.persistence.ts` 主流程可读：读取 -> normalize -> configure -> notify。
- 用 serialization parity 测试锁住行为后再拆。

## P3 — 测试覆盖集中在 compat，核心交互覆盖仍不均衡

**证据**

现有 migration 测试覆盖了 constants、context menu compat、LLink/LGraphGroup serialization、static canvas compat、global/CJS bridge、utils parity 等；但 coverage 输出显示 Graph/Node/Canvas 主链仍有大量未覆盖行。

**影响**

- 小型 compat helper 较安全，但 input/render/execution 主路径变更仍需要人工谨慎验证。
- 新拆分如果缺少行为锁定，容易出现 UI 交互回归。

**建议**

- 对每次主链拆分先补 characterization test。
- 优先覆盖：节点连接/断开、图执行顺序、序列化 configure、菜单关键路径、widget 输入。
- E2E 与 unit 测试要分层：unit 锁纯逻辑，Playwright 锁浏览器交互。

## 维护门禁

处理上述问题时，至少运行：

```bash
bun run typecheck
bun run build:ts-migration
bun run test
```

若 `bun run test` 因旧 `src/litegraph` 入口缺失失败，应在变更说明中明确这是旧入口依赖问题，而不是新增的迁移层 typecheck/build 失败。
