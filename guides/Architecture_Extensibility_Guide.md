# Architecture Extensibility Guide

本文面向 TS 迁移版本的扩展开发者，目标是支持“热插拔节点”和“外部系统接入（AI/硬件）”。

## 1. 节点注册机制

### 1.1 总体结构
当前架构采用 `LiteGraph + Registry + Runtime` 三层：

1. `assembleLiteGraph()` 组装命名空间（入口）
2. `LiteGraphRegistry` 负责节点类型注册/反注册/创建
3. `LiteGraphRuntime` 负责运行时辅助（slot 类型登记、函数包装节点、搜索项扩展等）

关键文件：
- `src/ts-migration/index.ts`
- `src/ts-migration/core/litegraph.registry.ts`
- `src/ts-migration/core/litegraph.runtime.ts`
- `src/ts-migration/core/litegraph.constants.ts`

### 1.2 注册数据结构
节点类型与类型系统相关索引保存在 `LiteGraphConstants` 中：
- `registered_node_types`: `type -> NodeClass`
- `Nodes`: `ClassName -> NodeClass`
- `node_types_by_file_extension`: 文件后缀映射
- `registered_slot_in_types` / `registered_slot_out_types`
- `slot_types_in` / `slot_types_out`
- `searchbox_extras`

### 1.3 注册流程（Class 节点）
`LiteGraph.registerNodeType(type, NodeClass)` 的核心行为：

1. 校验必须是可实例化类（有 `prototype`）
2. 写入 `NodeClass.type = type`，并从路径推导 `category`
3. 若缺省 `title`，使用类名
4. 将基础 `LGraphNode` 原型能力补到目标节点原型链
5. 写入注册表（同名类型会替换）
6. 若启用 `auto_load_slot_types`，临时实例化节点并自动登记输入/输出 slot 类型

`type` 路径规范：`"category/name"`，例如：`"custom/scale"`。

### 1.4 创建与热插拔
- 创建节点：`LiteGraph.createNode("custom/scale")`
- 卸载节点：`LiteGraph.unregisterNodeType("custom/scale")`
- 清空注册：`LiteGraph.clearRegisteredTypes()`（通常仅用于测试/隔离环境）

热插拔建议：
1. 插件加载时批量 `registerNodeType`
2. 插件卸载时按类型路径 `unregisterNodeType`
3. 避免在运行中的图上直接替换“正在执行”的节点类型，优先在切图或暂停执行窗口进行

### 1.5 轻量节点注册（无需手写类）
运行时提供两种快速扩展方式：
- `LiteGraph.buildNodeClassFromObject(...)`
- `LiteGraph.wrapFunctionAsNode(...)`

适合脚本化节点或快速原型，不适合复杂生命周期/状态管理场景。

## 2. 自定义节点模板（TypeScript）

下面是一个可直接复用的标准模板（Class 方式，推荐）：

```ts
import { LiteGraph, LGraphNode } from "../src/ts-migration/index";

type GainNodeProps = {
  gain: number;
  enabled: boolean;
};

export class GainNode extends LGraphNode {
  static title = "Gain";
  static desc = "Multiply input by gain";

  declare properties: GainNodeProps;

  constructor(title = "Gain") {
    super(title);

    // 数据输入输出
    this.addInput("in", "number");
    this.addOutput("out", "number");

    // 事件输入输出（ACTION/EVENT 在本实现中都是 -1）
    this.addInput("trigger", LiteGraph.ACTION as unknown as -1);
    this.addOutput("done", LiteGraph.EVENT as unknown as -1);

    // 属性定义（会进入 properties_info + properties）
    this.addProperty<number>("gain", 1, "number", { min: 0, max: 100, step: 0.1 });
    this.addProperty<boolean>("enabled", true, "boolean");

    this.properties = { gain: 1, enabled: true };
  }

  // 核心执行逻辑：图执行时被调用
  onExecute(): void {
    if (!this.properties.enabled) {
      return;
    }

    const input = this.getInputData<number>(0);
    if (input == null) {
      return;
    }

    const out = Number(input) * Number(this.properties.gain ?? 1);
    this.setOutputData(0, out);
  }

  // 事件动作入口（可选）
  onAction(action?: string, param?: unknown): void {
    if (action === "trigger") {
      this.trigger("done", param);
    }
  }

  // 属性变更拦截（可选，返回 false 可拒绝变更）
  onPropertyChanged(name: string, value: unknown): boolean | void {
    if (name === "gain" && (typeof value !== "number" || Number.isNaN(value))) {
      return false;
    }
  }

  // 生命周期钩子（可选）
  onAdded(): void {
    // 节点被加入 graph 后触发
  }

  onRemoved(): void {
    // 节点从 graph 移除时触发
  }
}

LiteGraph.registerNodeType("custom/gain", GainNode);
```

### 2.1 输入/输出配置规范

1. 插槽命名
- 语义化命名，避免 `input1`/`output1` 这类无语义名称

2. 类型约定
- 常规数据：`"number" | "string" | "boolean" | "vec2" ...`
- 多类型：`"number,string"`
- 事件：`LiteGraph.EVENT` / `LiteGraph.ACTION`

3. 属性定义
- 一律通过 `addProperty` 注册，避免只写 `this.properties.xxx` 导致 UI 元数据缺失

4. 执行期读写
- 读取输入：`getInputData(slotIndex)`
- 写入输出：`setOutputData(slotIndex, value)`

### 2.2 快速函数节点模板（可选）

```ts
import { LiteGraph } from "../src/ts-migration/index";

LiteGraph.wrapFunctionAsNode(
  "custom/add",
  (a: number, b: number) => a + b,
  ["number", "number"],
  "number"
);
```

## 3. 事件总线/通信机制（外部 AI / 硬件接入）

### 3.1 推荐接入边界
优先使用 `LGraph` 的图级 I/O 与事件接口，而不是直接操作 Canvas/UI 层：

- 图级数据口：
  - 写入：`graph.setInputData(name, data)`
  - 读取：`graph.getOutputData(name)`
- 图级动作：
  - `graph.onAction(action, param, options)`
  - `graph.trigger(action, param)`
- 广播给节点：
  - `graph.sendEventToAllNodes(eventName, params)`
- 结构变更/联动钩子：
  - `beforeChange` / `afterChange` / `connectionChange`

关键文件：
- `src/ts-migration/models/LGraph.io-events.ts`
- `src/ts-migration/models/LGraph.structure.ts`
- `src/ts-migration/models/LGraph.persistence.ts`

### 3.2 外部桥接示例（AI/硬件）

```ts
import { LGraph } from "../src/ts-migration/index";

type ExternalBus = {
  on: (event: string, cb: (payload: unknown) => void) => void;
  emit: (event: string, payload: unknown) => void;
};

export function attachExternalBridge(graph: LGraph, bus: ExternalBus): void {
  // 定义图级输入/输出（可选）
  graph.addInput("sensor.temperature", "number", 0);
  graph.addOutput("ai.command", "string", "");

  // 外部 -> 图
  bus.on("sensor.temperature", (value) => {
    graph.setInputData("sensor.temperature", value);
  });

  bus.on("ai.prompt", (payload) => {
    graph.onAction("ai.prompt", payload);
  });

  // 图 -> 外部
  graph.onTrigger = (action, param) => {
    bus.emit(`graph.trigger.${action}`, param);
  };

  // 若外部需要主动拉取图输出
  setInterval(() => {
    const command = graph.getOutputData<string>("ai.command");
    if (command != null) {
      bus.emit("ai.command", command);
    }
  }, 30);
}
```

### 3.3 接入原则（建议）

1. 解耦
- 外部系统只依赖 `LGraph`/`LiteGraph` API，不依赖 Canvas DOM

2. 可回放
- 外部入站消息尽量标准化为 `action + payload`，便于记录与回放

3. 热插拔安全
- 卸载节点类型前，先暂停图执行或切到安全窗口，再做 `unregisterNodeType`

4. 序列化一致性
- 若节点需要持久化扩展状态，确保通过 `properties`/`serialize`/`configure` 进入图数据快照链路

## 4. 最小扩展工作流（推荐）

1. 编写 `class MyNode extends LGraphNode`
2. 在构造函数中声明 inputs/outputs/properties
3. 实现 `onExecute`（必要）与可选钩子（`onAction`/`onPropertyChanged` 等）
4. 调用 `LiteGraph.registerNodeType("vendor/my_node", MyNode)`
5. 在 Graph 中创建并连线，使用 `runStep/start` 验证执行
6. 如需插件化，补充 `unregisterNodeType` 卸载路径

---

## 源码追踪索引
- `src/ts-migration/index.ts`
- `src/ts-migration/core/litegraph.constants.ts`
- `src/ts-migration/core/litegraph.registry.ts`
- `src/ts-migration/core/litegraph.runtime.ts`
- `src/ts-migration/models/LGraph.io-events.ts`
- `src/ts-migration/models/LGraph.structure.ts`
- `src/ts-migration/models/LGraph.persistence.ts`
- `src/ts-migration/models/LGraphNode.state.ts`
- `src/ts-migration/models/LGraphNode.execution.ts`
- `src/ts-migration/models/LGraphNode.ports-widgets.ts`
