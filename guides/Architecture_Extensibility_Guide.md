# Architecture Extensibility Guide

本文档描述当前仓库里真正稳定、可复用的扩展边界，适用于：

- 自定义节点
- 节点插件包
- 搜索框扩展
- 外部系统接入
- 兼容层适配

---

## 1. 先选扩展边界

当前工程有两种扩展入口。

### 1.1 默认扩展入口

直接使用 `src/ts-migration/index.ts` 的默认导出：

- `LiteGraph`
- `registry`
- `runtime`

适合：

- 给现有应用加节点
- 与仓库当前默认运行时共享注册表
- 沿用 legacy 节点包的行为

### 1.2 隔离扩展入口

调用 `assembleLiteGraph()` 创建独立装配体。

适合：

- 测试环境
- 多实例隔离
- 插件沙箱
- 不希望污染默认全局注册表

```ts
import { assembleLiteGraph } from "../src/ts-migration/index";

const bundle = assembleLiteGraph();
const { LiteGraph, LGraphNode } = bundle;
```

结论很简单：

- 想扩展当前默认运行时，用默认导出
- 想做隔离插件系统，用 `assembleLiteGraph()`

---

## 2. 当前可依赖的扩展 API

`LiteGraph` 命名空间当前已经把 registry/runtime 能力暴露出来，常用入口包括：

- `registerNodeType(type, NodeClass)`
- `unregisterNodeType(type)`
- `clearRegisteredTypes()`
- `addNodeMethod(name, func)`
- `createNode(type, title?, options?)`
- `getNodeType(type)`
- `getNodeTypesInCategory(category, filter)`
- `registerNodeAndSlotType(typeOrNode, slotType, out?)`
- `buildNodeClassFromObject(name, shape)`
- `wrapFunctionAsNode(name, fn, paramTypes?, returnType?, properties?)`
- `registerSearchboxExtra(nodeType, description, data)`

其中职责边界是：

- `registerNodeType / createNode / addNodeMethod` 属于注册表能力
- `registerNodeAndSlotType / buildNodeClassFromObject / wrapFunctionAsNode / registerSearchboxExtra` 属于 runtime 能力

---

## 3. 节点扩展的主路径

### 3.1 推荐方式：类节点

当前最稳的方式仍然是 `class MyNode extends LGraphNode`。

```ts
import { LiteGraph, LGraphNode } from "../src/ts-migration/index";

type GainProps = {
  gain: number;
  enabled: boolean;
};

export class GainNode extends LGraphNode {
  static title = "Gain";
  static desc = "Multiply input by gain";

  declare properties: GainProps;

  constructor(title = "Gain") {
    super(title);

    this.addInput("in", "number");
    this.addOutput("out", "number");
    this.addInput("trigger", LiteGraph.ACTION as unknown as -1);
    this.addOutput("done", LiteGraph.EVENT as unknown as -1);

    this.addProperty("gain", 1, "number", { min: 0, max: 100, step: 0.1 });
    this.addProperty("enabled", true, "boolean");

    this.properties = {
      gain: 1,
      enabled: true,
    };
  }

  onExecute(): void {
    if (!this.properties.enabled) {
      return;
    }

    const input = this.getInputData<number>(0);
    if (input == null) {
      return;
    }

    this.setOutputData(0, Number(input) * Number(this.properties.gain ?? 1));
  }

  onAction(action?: string, param?: unknown): void {
    if (action === "trigger") {
      this.trigger("done", param);
    }
  }

  onPropertyChanged(name: string, value: unknown): boolean | void {
    if (name === "gain" && (typeof value !== "number" || Number.isNaN(value))) {
      return false;
    }
  }
}

LiteGraph.registerNodeType("custom/gain", GainNode);
```

### 3.2 为什么推荐类节点

因为它天然覆盖了当前最完整的扩展面：

- 生命周期
- 属性与 widgets
- 输入输出槽
- 连接与事件
- 序列化与反序列化
- 画布协作

### 3.3 注册时实际会发生什么

`registerNodeType()` 当前会做这些事：

1. 写入 `NodeClass.type`
2. 从 `category/name` 推导 `category`
3. 若缺省 `title`，回退到类名
4. 把 `LGraphNode` 原型方法补到目标节点原型上
5. 写入 `registered_node_types` 与 `Nodes`
6. 若开启 `auto_load_slot_types`，临时实例化节点并自动登记输入输出类型

这意味着：

- `type` 应保持 `category/name` 形式
- 构造函数最好是无副作用或低副作用
- 若注册阶段会探测槽位，不要在构造时做昂贵 IO

---

## 4. 轻量扩展路径

### 4.1 `buildNodeClassFromObject(...)`

适合快速原型或配置驱动节点。

```ts
LiteGraph.buildNodeClassFromObject("custom/sum", {
  title: "Sum",
  inputs: [["a", "number"], ["b", "number"]],
  outputs: [["out", "number"]],
  onExecute() {
    this.setOutputData(0, (this.getInputData(0) ?? 0) + (this.getInputData(1) ?? 0));
  },
});
```

限制也很明确：

- 这是运行时拼装出来的类
- 适合简单节点
- 不适合复杂状态、复杂生命周期或重度类型约束

### 4.2 `wrapFunctionAsNode(...)`

适合把纯函数快速暴露成节点。

```ts
LiteGraph.wrapFunctionAsNode(
  "custom/add",
  (a: number, b: number) => a + b,
  ["number", "number"],
  "number"
);
```

它会：

- 依据函数参数名生成输入槽
- 自动创建 `out` 输出
- 在 `onExecute()` 中读取输入并调用目标函数

---

## 5. 你真正能扩展的节点能力

### 5.1 属性与 widgets

建议统一通过 `addProperty(...)` 声明属性，而不是只写 `this.properties.xxx`。

原因是 `addProperty(...)` 会同时维护：

- `properties`
- `properties_info`

属性变更建议通过 `onPropertyChanged(name, value, prevValue)` 做校验。返回 `false` 可以拒绝写入。

如果节点需要持久化 widgets 值，记得启用：

- `serialize_widgets = true`

### 5.2 动态输入输出

当前 Canvas 菜单系统已经支持动态可选端口，扩展点包括：

- `optional_inputs`
- `optional_outputs`
- `onGetInputs()`
- `onGetOutputs()`
- `onMenuNodeInputs(entries)`
- `onMenuNodeOutputs(entries)`
- `onNodeInputAdd(slotInfo)`
- `onNodeOutputAdd(slotInfo)`

典型约定是：

```ts
optional_inputs = [
  ["threshold", "number", { label: "Threshold" }],
  ["trigger", LiteGraph.ACTION, { label: "Trigger" }],
];
```

菜单点击后，框架会实际调用：

- `node.addInput(...)`
- `node.addOutput(...)`

并包裹：

- `graph.beforeChange()`
- `graph.afterChange()`

因此这里是当前“可选端口菜单”的标准接入点，不需要自己操作 DOM。

### 5.3 事件与动作节点

事件型节点主要扩展点是：

- `onAction(...)`
- `trigger(...)`
- `triggerSlot(...)`

如果节点是触发式执行，可以结合：

- `LiteGraph.ACTION`
- `LiteGraph.EVENT`
- `LiteGraph.ON_TRIGGER`

需要注意的是，执行流的细节以当前 runtime 为准，不要把 `onAction` 当成 `onExecute` 的简单别名。

---

## 6. 搜索框与类型系统扩展

### 6.1 slot 类型登记

如果你的节点引入了新的 slot type，可以使用：

- `registerNodeAndSlotType(typeOrNode, slotType, out?)`

它会更新：

- `registered_slot_in_types`
- `registered_slot_out_types`
- `slot_types_in`
- `slot_types_out`

多数情况下，`registerNodeType()` 配合 `auto_load_slot_types` 已经够用；只有做动态槽位或后注册补丁时，才需要手动调用。

### 6.2 搜索框扩展

搜索框额外入口通过：

- `registerSearchboxExtra(nodeType, description, data)`

写入 `searchbox_extras`，再由搜索控制器消费。

这适合：

- 给节点补搜索关键词
- 提供别名入口
- 注入额外搜索候选项

---

## 7. 外部系统接入的推荐边界

外部 AI、硬件、网络桥接，优先接到 `LGraph`，不要直接耦合 Canvas 或 DOM。

优先使用：

- `graph.addInput(...)`
- `graph.addOutput(...)`
- `graph.setInputData(name, value)`
- `graph.getOutputData(name)`
- `graph.onAction(action, param, options)`
- `graph.trigger(action, param)`
- `graph.sendEventToAllNodes(eventName, params)`

原因很直接：

- graph API 更稳定
- 不依赖 UI 生命周期
- 更容易录制、回放和测试

一个重要现实限制是：

- graph 级 `inputs/outputs` 当前是运行态模型
- 但当前 serializer 不会把它们写进最终 graph JSON

也就是说，如果你的插件依赖 graph 全局 IO 元数据，不能假设它会自动持久化。

---

## 8. 兼容层扩展规则

如果你做的是“兼容旧 API”而不是“新增节点”，入口不应写在业务模型里，而应走 compat façade。

当前兼容层的单一真相是：

- `src/ts-migration/compat/compat-schema.ts`
- `src/ts-migration/compat/compat-runtime.ts`
- `src/ts-migration/types/litegraph-compat.ts`

推荐顺序：

1. 先在 `compat-schema.ts` 定义差异与契约
2. 再在 `compat-runtime.ts` 实现运行时映射
3. 最后通过 `types/litegraph-compat.ts` 对外导出

不要把兼容逻辑重新散回：

- `LGraph.*`
- `LGraphNode.*`
- `LGraphCanvas.*`

---

## 9. 与 legacy 节点包的关系

仓库里的 legacy 节点包 `src/nodes/*.js` 仍然大量使用：

- `LiteGraph.registerNodeType(...)`

所以新增插件时，最稳的做法仍然是遵循同一注册契约，而不是发明另一套扩展协议。

这也意味着：

- 你写的 TS 节点与 legacy 节点在注册方式上是兼容的
- 迁移期间可以并存
- 若要做节点包迁移，优先保持 `category/name` 与生命周期钩子不变

---

## 10. 推荐插件工作流

### 10.1 最小工作流

1. 写 `class MyNode extends LGraphNode`
2. 在构造函数中声明 inputs、outputs、properties
3. 实现 `onExecute()`，必要时实现 `onAction()` 或 `onPropertyChanged()`
4. 调用 `LiteGraph.registerNodeType("vendor/my_node", MyNode)`
5. 若需要动态端口，补 `optional_inputs / onGetInputs / onMenuNodeInputs`
6. 若需要搜索增强，补 `registerSearchboxExtra(...)`
7. 若需要卸载，调用 `LiteGraph.unregisterNodeType(...)`

### 10.2 工程级建议

- 不要在节点构造函数里做网络请求或重量级初始化
- 运行态状态尽量放在实例字段，持久化状态放在 `properties`
- 若节点需要完整恢复，确认状态能经过 `serialize/configure` 链路
- 外部桥接尽量挂在 graph，而不是 node 的 DOM 事件
- 需要隔离时，用 `assembleLiteGraph()` 生成独立 bundle

---

## 11. 关键源码

- `src/ts-migration/index.ts`
- `src/ts-migration/core/litegraph.namespace.ts`
- `src/ts-migration/core/litegraph.registry.ts`
- `src/ts-migration/core/litegraph.runtime.ts`
- `src/ts-migration/models/LGraph.io-events.ts`
- `src/ts-migration/models/LGraphNode.state.ts`
- `src/ts-migration/models/LGraphNode.execution.ts`
- `src/ts-migration/models/LGraphNode.ports-widgets.ts`
- `src/ts-migration/models/LGraphNode.connect-geometry.ts`
- `src/ts-migration/canvas/LGraphCanvas.static.ts`
- `src/ts-migration/services/searchbox-controller.ts`
- `src/ts-migration/compat/compat-schema.ts`
- `src/ts-migration/compat/compat-runtime.ts`
- `src/ts-migration/types/litegraph-compat.ts`
