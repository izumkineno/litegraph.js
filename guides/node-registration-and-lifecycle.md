# LiteGraph 节点注册、可调用 API 与生命周期指南

本文聚焦以下问题：

- 节点如何注册（有哪些方式）
- 注册后的节点可以调用哪些核心函数
- 节点生命周期回调有哪些、在什么时候触发
- 如何完整地添加并使用一个新节点

基于当前仓库实现：`src/litegraph.js`。

## 1. 节点注册的三种方式

## 1.1 方式 A：构造函数 + `LiteGraph.registerNodeType`（最常用）

这是官方默认方式，灵活度最高。

```js
function MySumNode() {
  this.addInput("A", "number");
  this.addInput("B", "number");
  this.addOutput("A+B", "number");
  this.properties = { clamp_min: null, clamp_max: null };
}

MySumNode.title = "Sum";
MySumNode.desc = "Add two numbers";

MySumNode.prototype.onExecute = function () {
  let a = this.getInputData(0);
  let b = this.getInputData(1);
  if (a == null) a = 0;
  if (b == null) b = 0;
  let v = a + b;

  if (this.properties.clamp_min != null) v = Math.max(v, this.properties.clamp_min);
  if (this.properties.clamp_max != null) v = Math.min(v, this.properties.clamp_max);

  this.setOutputData(0, v);
};

LiteGraph.registerNodeType("math/sum2", MySumNode);
```

关键点：

- `registerNodeType("category/name", Ctor)` 的字符串会决定节点路径和分类。
- 注册时，`LGraphNode.prototype` 上的方法会被混入你的节点原型（无需手动继承）。
- 如果同名重复注册，会替换旧类型（控制台会提示 replacing node type）。

## 1.2 方式 B：`LiteGraph.wrapFunctionAsNode`（快速包装函数）

适合纯函数节点（输入 -> 输出），不需要复杂状态/交互。

```js
function mul(a, b) {
  return a * b;
}

LiteGraph.wrapFunctionAsNode(
  "math/mul2",
  mul,
  ["number", "number"],
  "number"
);
```

特点：

- 自动生成节点类、输入槽、输出槽和 `onExecute` 包装。
- 适合简单计算，不适合复杂 UI/回调生命周期。

## 1.3 方式 C：`LiteGraph.buildNodeClassFromObject`

通过对象描述动态创建节点类，再注册。

```js
LiteGraph.buildNodeClassFromObject("basic/const_str2", {
  title: "Const String 2",
  inputs: [],
  outputs: [["value", "string"]],
  properties: { value: "hello" },
  onExecute: function () {
    this.setOutputData(0, this.properties.value);
  }
});
```

适用场景：

- 批量配置化生成节点。
- 运行时动态扩展节点集合。

---

## 2. 节点创建与使用流程

注册后，通常通过以下流程使用：

1. `LiteGraph.createNode(type)` 创建实例。
2. `graph.add(node)` 挂入图。
3. `node.connect(...)` 连接到其他节点。
4. `graph.start()` 或 `graph.runStep()` 开始执行。

示例：

```js
const graph = new LGraph();

const n1 = LiteGraph.createNode("basic/const");
n1.pos = [80, 120];
n1.setValue(3);
graph.add(n1);

const n2 = LiteGraph.createNode("basic/watch");
n2.pos = [360, 120];
graph.add(n2);

n1.connect(0, n2, 0);
graph.start();
```

---

## 3. 节点内可调用的核心 API

说明：这些方法来自 `LGraphNode.prototype`，注册时会混入你的节点。

## 3.1 槽位与数据流

- `addInput(name, type, extra?)`
- `addOutput(name, type, extra?)`
- `removeInput(slot)`
- `removeOutput(slot)`
- `getInputData(slot, force_update?)`
- `getInputDataByName(name, force_update?)`
- `setOutputData(slot, data)`
- `getOutputData(slot)`
- `isInputConnected(slot)`
- `isOutputConnected(slot)`
- `getInputNode(slot)`
- `getOutputNodes(slot)`

## 3.2 连线控制

- `connect(outputSlot, targetNode, targetSlot)`
- `connectByType(outputSlot, targetNode, targetType, opts?)`
- `connectByTypeOutput(inputSlot, sourceNode, sourceType, opts?)`
- `disconnectInput(slot)`
- `disconnectOutput(slot, targetNode?)`

## 3.3 事件与执行流

- `doExecute(param?, options?)`：包装执行，含执行状态标记。
- `actionDo(action, param?, options?, action_slot?)`：包装动作调用。
- `trigger(action?, param?, options?)`：按名称触发事件输出槽。
- `triggerSlot(slot, param?, link_id?, options?)`
- `executePendingActions()`：执行 deferred actions。

## 3.4 属性与组件

- `addProperty(name, defaultValue, type?, extra?)`
- `setProperty(name, value)`（会触发 `onPropertyChanged`）
- `addWidget(type, name, value, callback?, options?)`
- `addCustomWidget(widget)`

## 3.5 位置、尺寸与画布辅助

- `computeSize()`
- `setSize([w, h])`
- `getConnectionPos(is_input, slot, out?)`
- `alignToGrid()`
- `setDirtyCanvas(fg?, bg?)`
- `collapse(force?)`
- `pin(v?)`

---

## 4. 生命周期回调（何时触发）

下文按“注册 -> 实例化 -> 执行 -> 交互 -> 持久化 -> 销毁”顺序梳理。

## 4.1 注册阶段

- `LiteGraph.registerNodeType(...)`
  - 设置 `type/category/title`
  - 混入 `LGraphNode.prototype` 方法
  - 触发全局回调：
    - `LiteGraph.onNodeTypeRegistered(type, ctor)`
    - 若替换：`LiteGraph.onNodeTypeReplaced(type, newCtor, oldCtor)`

## 4.2 实例化阶段

当调用 `LiteGraph.createNode(type, title?, options?)`：

1. `new Ctor(title)`：你的构造函数执行。
2. 初始化缺省字段（`properties/flags/size/pos/mode`）。
3. 调用节点实例回调：`onNodeCreated()`（如果定义）。

当节点加入图 `graph.add(node)`：

4. 分配/校验 `node.id`。
5. 设置 `node.graph`。
6. 回调 `node.onAdded(graph)`。
7. 重新计算执行顺序 `updateExecutionOrder()`（默认）。

当图从 JSON 反序列化 `graph.configure(data)`：

- 会先 `createNode + add(node, true)`，再 `node.configure(info)`。
- 这意味着：`onAdded` 早于 `onConfigure`。源码注释也明确提醒了这一点。

## 4.3 运行阶段

图启动/停止：

- `graph.start()` 后会广播所有节点 `onStart()`
- `graph.stop()` 后会广播所有节点 `onStop()`

每个执行步 `runStep()`：

- `mode == LiteGraph.ALWAYS` 且有 `onExecute` 的节点会被执行。
- 事件链会走 `trigger/triggerSlot`，目标节点可能触发：
  - `onExecute`（`ON_TRIGGER` 模式）
  - `onAction`（动作输入）
- 包装执行后会触发 `onAfterExecuteNode(param, options)`（如果定义）

## 4.4 编辑器交互阶段

常见回调：

- 交互：
  - `onMouseDown`, `onMouseMove`, `onMouseUp`
  - `onMouseEnter`, `onMouseLeave`
  - `onDblClick`
  - `onInputClick/onInputDblClick`
  - `onOutputClick/onOutputDblClick`
- 绘制：
  - `onDrawBackground`
  - `onDrawForeground`
  - `onDrawCollapsed`
- 连接控制：
  - `onBeforeConnectInput`
  - `onConnectInput`
  - `onConnectOutput`
  - `onConnectionsChange`

## 4.5 属性与持久化阶段

- 属性改动：
  - `setProperty()` -> `onPropertyChanged(name, value, prevValue)`
- 序列化：
  - `node.serialize()` 内部会调用 `onSerialize(o)` 让你补充字段
- 反序列化：
  - `node.configure(info)` 内部结束后会回调 `onConfigure(info)`

## 4.6 销毁阶段

- `graph.remove(node)`：
  1. 断开输入输出连线
  2. 调用 `node.onRemoved()`
  3. 从图与画布状态中移除节点

---

## 5. 添加新节点的推荐模板

## 5.1 最小可用模板（计算类节点）

```js
function MyNode() {
  this.addInput("in", "number");
  this.addOutput("out", "number");
  this.properties = { gain: 1.0 };
}

MyNode.title = "My Node";
MyNode.desc = "input * gain";

MyNode.prototype.onExecute = function () {
  let v = this.getInputData(0);
  if (v == null) v = 0;
  this.setOutputData(0, v * this.properties.gain);
};

MyNode.prototype.onPropertyChanged = function (name, value, prev) {
  if (name === "gain" && Number.isNaN(Number(value))) return false;
};

LiteGraph.registerNodeType("custom/my_node", MyNode);
```

## 5.2 事件型模板（`onAction` + `trigger`）

```js
function EventPassNode() {
  this.addInput("in", LiteGraph.ACTION);
  this.addOutput("out", LiteGraph.EVENT);
}

EventPassNode.title = "Event Pass";

EventPassNode.prototype.onAction = function (action, param) {
  // 事件到达后直接透传
  this.trigger("out", param);
};

LiteGraph.registerNodeType("custom/event_pass", EventPassNode);
```

## 5.3 带控件模板（Widget）

```js
function GainNode() {
  this.addInput("in", "number");
  this.addOutput("out", "number");
  this.properties = { gain: 1.0 };

  this.addWidget(
    "number",
    "Gain",
    this.properties.gain,
    (value) => this.setProperty("gain", Number(value)),
    { min: 0, max: 10, step: 0.1, precision: 2 }
  );
}

GainNode.title = "Gain";
GainNode.prototype.onExecute = function () {
  const x = this.getInputData(0) ?? 0;
  this.setOutputData(0, x * this.properties.gain);
};

LiteGraph.registerNodeType("custom/gain", GainNode);
```

---

## 6. 常见坑与建议

## 6.1 回调命名

- 用 `onPropertyChanged`，不要写成 `onPropertyChange`（源码会警告）。

## 6.2 `onAdded` 与 `onConfigure` 顺序

- 从 JSON 加载时，`onAdded` 先触发，`onConfigure` 后触发。
- 依赖完整配置数据的逻辑，应放在 `onConfigure`。

## 6.3 `mode` 与执行条件

- 仅定义 `onExecute` 不代表一定执行；还受 `mode` 影响。
- 事件链需要正确使用 `LiteGraph.ACTION`/`LiteGraph.EVENT` 与 `onAction/trigger`。

## 6.4 连接类型

- `connect` 会走 `LiteGraph.isValidConnection`。
- 不匹配时连接会失败，可用 `connectByType` 提升自动匹配成功率。

## 6.5 性能建议

- `onDrawForeground/onDrawBackground` 避免昂贵运算。
- 高频节点尽量减少对象分配，优先复用数组/缓存。

---

## 7. 源码定位索引

- 注册与工厂：
  - `registerNodeType`: `src/litegraph.js:157`
  - `unregisterNodeType`: `src/litegraph.js:260`
  - `buildNodeClassFromObject`: `src/litegraph.js:334`
  - `wrapFunctionAsNode`: `src/litegraph.js:388`
  - `createNode`: `src/litegraph.js:476`
- 图与生命周期：
  - `LGraph.add`: `src/litegraph.js:1469`
  - `LGraph.remove`: `src/litegraph.js:1548`
  - `LGraph.start`: `src/litegraph.js:975`
  - `LGraph.runStep`: `src/litegraph.js:1054`
  - `LGraph.configure`: `src/litegraph.js:2240`
- 节点核心 API：
  - `doExecute`: `src/litegraph.js:3222`
  - `triggerSlot`: `src/litegraph.js:3306`
  - `connect`: `src/litegraph.js:4293`
  - `disconnectOutput`: `src/litegraph.js:4503`
  - `disconnectInput`: `src/litegraph.js:4659`

---

## 8. 方法级速查表（参数 / 返回 / 副作用 / 用法）

这部分面向“写节点时快速决策”。如果你不确定一个 API 的后果，先看“副作用”列。

## 8.1 数据流 API

| API | 参数 | 返回 | 关键副作用 | 典型用法 | 注意事项 |
| --- | --- | --- | --- | --- | --- |
| `setOutputData(slot, data)` | `slot:number`, `data:any` | 无 | 写 `outputs[slot]._data`，并把 `data` 同步到每条 `link.data` | 在 `onExecute` 末尾产出结果 | `slot` 越界会静默返回；节点必须已在 graph 中连接后下游才能读到 |
| `getInputData(slot, force_update?)` | `slot:number`, `force_update?:boolean` | `any \| undefined \| null` | `force_update=true` 时可能触发上游 `updateOutputData/onExecute` | 读取输入值 | 强制更新可能造成重复执行与性能问题 |
| `getInputDataByName(name, force_update?)` | `name:string` | 同上 | 先做槽名查找，再委托 `getInputData` | 动态槽位场景按名字读 | 名字找不到返回 `null` |
| `getInputOrProperty(name)` | `name:string` | `any` | 无 | 输入可覆盖属性默认值 | 只有输入已连接时才优先读输入 |
| `getOutputData(slot)` | `slot:number` | `any \| null` | 无 | 调试节点当前输出缓存 | 仅返回最近一次写入 `_data` |

## 8.2 槽位定义 API

| API | 参数 | 返回 | 关键副作用 | 典型用法 | 注意事项 |
| --- | --- | --- | --- | --- | --- |
| `addInput(name, type, extra?)` | `name:string`, `type:string\|number` | `input object` | 修改 `inputs`，`computeSize()`，`setDirtyCanvas(true,true)` | 在构造函数定义输入 | 会触发 `onInputAdded` |
| `addOutput(name, type, extra?)` | `name:string`, `type:string\|number` | `output object` | 修改 `outputs`，`computeSize()`，`setDirtyCanvas(true,true)` | 在构造函数定义输出 | 会触发 `onOutputAdded` |
| `removeInput(slot)` | `slot:number` | 无 | 自动断开该输入并修正后续 link 的 `target_slot` | 动态删除输入槽 | 删除后槽位索引会整体前移 |
| `removeOutput(slot)` | `slot:number` | 无 | 自动断开输出并修正后续 link 的 `origin_slot` | 动态删除输出槽 | 同上，索引漂移要注意 |
| `computeSize(out?)` | `out?:vec2` | `vec2` | 无（纯计算） | 自定义 UI 后重算尺寸 | widgets 会显著影响结果 |

## 8.3 连线 API

| API | 参数 | 返回 | 关键副作用 | 典型用法 | 注意事项 |
| --- | --- | --- | --- | --- | --- |
| `connect(slot, target_node, target_slot)` | 输出槽、目标节点、目标输入槽 | `LLink \| null` | 修改 `graph.links`、输入输出槽 link 关系，触发连接回调和 `graph.connectionChange` | 精确连接 | 会做类型校验，失败返回 `null` |
| `connectByType(slot, target_node, target_type, opts?)` | 按类型连接到目标输入 | `LLink \| null` | 内部会降级尝试通用槽/空闲槽 | 自动布线 | 不是 100% 成功，仍需判空 |
| `connectByTypeOutput(slot, source_node, source_type, opts?)` | 按类型从来源输出连接到当前输入 | `LLink \| null` | 同上 | 从输入侧发起自动连接 | 事件模式受 `do_add_triggers_slots` 影响 |
| `disconnectInput(slot)` | `slot:number\|string` | `boolean` | 删除对应 `graph.links`，同步清理对端输出列表并触发回调 | 断开某个输入 | 传字符串时按槽名查找 |
| `disconnectOutput(slot, target_node?)` | `slot:number\|string`，可选目标节点 | `boolean` | 删除一个或所有输出连线并触发回调 | 断开某个输出到全部/指定目标 | target 指定时只删匹配链路 |

## 8.4 执行与事件 API

| API | 参数 | 返回 | 关键副作用 | 典型用法 | 注意事项 |
| --- | --- | --- | --- | --- | --- |
| `doExecute(param?, options?)` | 执行参数 | 无 | 标记 `nodes_executing`、写 `exec_version/action_call`、触发 `onAfterExecuteNode` | 包装执行节点逻辑 | 一般由框架调用，不建议手动高频调用 |
| `actionDo(action, param?, options?, action_slot?)` | 动作名与参数 | 无 | 标记 `nodes_actioning`、触发 `onAfterExecuteNode` | 包装 `onAction` | 与 `doExecute` 语义不同，适合动作输入 |
| `trigger(action?, param?, options?)` | 事件名（可空） | 无 | 遍历 EVENT 输出并调用 `triggerSlot` | 从节点发事件 | 仅对 `output.type===LiteGraph.EVENT` 生效 |
| `triggerSlot(slot, param?, link_id?, options?)` | 指定输出槽触发 | 无 | 更新 link 触发时间，驱动下游 `onExecute/onAction` | 精确事件控制 | `slot` 必须 number |
| `executePendingActions()` | 无 | 无 | 执行延迟动作队列 `_waiting_actions` | 与 deferred action 配合 | 通常由图执行循环调用 |

## 8.5 属性与 Widget API

| API | 参数 | 返回 | 关键副作用 | 典型用法 | 注意事项 |
| --- | --- | --- | --- | --- | --- |
| `addProperty(name, default, type?, extra?)` | 属性定义 | property meta | 更新 `properties` 与 `properties_info` | 声明可配置参数 | 更偏“声明”而非实时变更 |
| `setProperty(name, value)` | 属性名和值 | 无 | 触发 `onPropertyChanged`；若返回 `false` 会回滚；同步绑定 widget | 在回调中安全更新属性 | 避免在 `onPropertyChanged` 内死循环改同属性 |
| `addWidget(type, name, value, callback?, options?)` | 控件定义 | widget object | 更新 `widgets` 并触发 `computeSize()` | 数值滑杆、下拉、按钮等 | `combo` 必须提供 `options.values` |
| `addCustomWidget(widget)` | 自定义 widget 对象 | widget object | 直接挂入 `widgets` | 高级自定义渲染与交互 | 需自行处理绘制/事件逻辑 |
| `configure(info)` | 序列化对象 | 无 | 覆盖节点状态，触发连接相关回调，最终 `onConfigure` | 从 JSON 恢复节点 | 加载时 `onAdded` 先于 `onConfigure` |
| `serialize()` | 无 | `object` | 清理输出 `_data` 后导出，可能调用 `onSerialize` | 保存图 | 默认不保存 widget 值，除非 `serialize_widgets=true` |
| `clone()` | 无 | `LGraphNode \| null` | 通过序列化+配置复制节点并清空连线 | 复制节点模板 | 克隆失败通常是类型未注册 |

## 8.6 画布与交互辅助 API

| API | 参数 | 返回 | 关键副作用 | 典型用法 | 注意事项 |
| --- | --- | --- | --- | --- | --- |
| `setDirtyCanvas(fg?, bg?)` | 前景/背景脏标记 | 无 | 通知所有 graphcanvas 重绘 | 节点视觉状态变化后刷新 | 只标记，不立即同步绘制 |
| `getConnectionPos(is_input, slot, out?)` | 输入/输出槽位置查询 | `vec2` | 无 | 自定义连线/命中检测 | 折叠态和横向节点位置计算不同 |
| `alignToGrid()` | 无 | 无 | 修改 `pos` 吸附网格 | 拖拽落位后整理 | 取决于网格大小 `CANVAS_GRID_SIZE` |
| `captureInput(v)` | `v:boolean` | 无 | 把当前节点设为 canvas 的 `node_capturing_input` | 复杂拖拽控件 | 记得释放（`false`） |
| `collapse(force?)` | 可选强制参数 | 无 | 切换 `flags.collapsed` 并重绘 | 折叠/展开节点 | `constructor.collapsable===false` 时可能被阻止 |
| `pin(v?)` | 可选布尔 | 无 | 修改 `flags.pinned` | 防止节点被移动/重排 | 仅影响交互逻辑，不影响执行 |

## 8.7 查找与自动布线 API

| API | 参数 | 返回 | 关键副作用 | 典型用法 | 注意事项 |
| --- | --- | --- | --- | --- | --- |
| `findInputSlot(name, returnObj?)` | 槽名 | `index \| slotObj \| -1` | 无 | 动态槽按名定位 | 名称重复时只返回第一个 |
| `findOutputSlot(name, returnObj?)` | 槽名 | `index \| slotObj \| -1` | 无 | 同上 | 同上 |
| `findInputSlotByType(type, ...)` | 类型匹配 | `index \| slotObj \| -1` | 无 | 自动连线前定位输入槽 | `*`/`0` 会按通配处理 |
| `findOutputSlotByType(type, ...)` | 类型匹配 | `index \| slotObj \| -1` | 无 | 自动连线前定位输出槽 | 同上 |
| `findInputSlotFree(opts?)` | 可选过滤 | `index \| slotObj \| -1` | 无 | 给动态输入找空位 | 可排除事件槽 |
| `findOutputSlotFree(opts?)` | 可选过滤 | `index \| slotObj \| -1` | 无 | 给动态输出找空位 | 同上 |

## 8.8 推荐调用模式

- 纯计算节点：`onExecute` 内使用 `getInputData` + `setOutputData`。
- 事件节点：`onAction` 内使用 `trigger/triggerSlot`。
- 动态槽节点：先 `find*Slot*` 再 `connectByType`，连接失败要判空。
- 属性驱动节点：统一通过 `setProperty` 改值，避免绕过 `onPropertyChanged`。
- 有控件节点：`addWidget(..., { property: "x" })` 绑定属性，减少手写同步代码。
