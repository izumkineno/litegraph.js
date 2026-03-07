# litegraph.js

本仓库是 `litegraph.js` 的本地工作副本。当前代码库不是单一实现，而是三部分并存：

- legacy runtime：`src/litegraph.js` 与 `src/nodes/*.js`
- TS 迁移层：`src/ts-migration/**`
- 发布产物与工具链：`dist/**`、`scripts/*.mjs`、`tests/**`

如果你是在这个仓库里继续开发，建议把它理解成“正在重构中的同一套引擎”，而不是“旧版和新版两个独立项目”。

## 当前仓库入口

- 核心发布入口：`dist/litegraph.core.js`
- 包导出：
  - `litegraph.js`
  - `litegraph.js/core`
  - `litegraph.js/basic`
  - `litegraph.js/extended`
  - `litegraph.js/css`
- 运行时源码：
  - `src/litegraph.js`
  - `src/nodes/*.js`
- TS 装配入口：
  - `src/ts-migration/index.ts`
- 架构文档：
  - `guides/Architecture_Overview.md`
  - `guides/Architecture_Data_Model.md`
  - `guides/Architecture_Execution_Flow.md`
  - `guides/Architecture_Extensibility_Guide.md`

## 本地开发命令

本仓库当前使用 `bun` 作为包管理与脚本入口，常用命令如下：

```bash
bun install
bun run build
bun run build:ts-migration
bunx tsc -p tsconfig.typecheck.json
bunx jest
npx playwright test
```

对应脚本含义：

- `bun run build`：构建 dist 分发产物
- `bun run build:ts-migration`：单独构建 TS 迁移层
- `bunx tsc -p tsconfig.typecheck.json`：类型检查
- `bunx jest`：单元测试
- `npx playwright test`：端到端测试

## 代码阅读建议

推荐阅读顺序：

1. `guides/Architecture_Overview.md`
2. `src/ts-migration/README.md`
3. `src/ts-migration/index.ts`
4. `src/ts-migration/core/litegraph.namespace.ts`
5. `src/ts-migration/models/LGraph.*`
6. `src/ts-migration/models/LGraphNode.*`
7. `src/litegraph.js`
8. `src/nodes/*.js`

这条顺序的目的很明确：

- 先建立仓库级结构认知
- 再看 TS 迁移层的装配与模型
- 最后回到 legacy runtime 和内置节点包

## 当前架构事实

这几个事实在继续开发时要默认成立：

- `src/ts-migration/**` 已经是当前仓库最清晰的架构表达
- `src/litegraph.js` 和 `src/nodes/*.js` 仍然是实际交付链路的一部分
- `src/ts-migration/index.ts` 在模块加载时会创建默认装配体，并导出 `LiteGraph`、`registry`、`runtime`
- compat 已经收敛到 `compat-schema.ts -> compat-runtime.ts -> litegraph-compat facade`
- graph persistence 已经拆成 `serialization-repair -> graph-serializer -> graph-deserializer -> facade`

## 最小使用示例

```js
import { LGraph, LGraphCanvas } from "litegraph.js";

const graph = new LGraph();
const canvas = new LGraphCanvas("#graph", graph);

graph.start();
```

如果你要扩展节点，优先看：

- `guides/Architecture_Extensibility_Guide.md`
- `src/ts-migration/core/litegraph.registry.ts`
- `src/ts-migration/core/litegraph.runtime.ts`

## 仓库目录速览

- `src/`：运行时源码与 TS 迁移层
- `dist/`：构建输出
- `editor/`：编辑器相关资源
- `tests/`：Jest 与 Playwright 测试
- `guides/`：架构与使用说明
- `scripts/`：构建脚本

## 上游项目

源仓库仍：

- [https://github.com/jagenjo/litegraph.js](https://github.com/jagenjo/litegraph.js)

但这个仓库里的 README 和 `guides/**` 描述的是“当前本地代码状态”，不等同于上游 master 的任意历史时刻。
