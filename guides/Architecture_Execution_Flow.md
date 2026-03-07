# Architecture Execution Flow

本文档描述当前代码中的执行与交互主路径，覆盖：

- graph 启停与调度
- 节点创建、入图、连接、断开
- 计划执行与事件触发两条执行路径
- graph 与 canvas 的同步机制
- 子图切换与恢复

## 1. 两条长期循环

当前系统存在两条相互解耦的长期循环：

### 1.1 Graph 执行循环

由 `LGraph.start(interval?)` 驱动：

- `interval === 0` 且浏览器支持 `requestAnimationFrame`
  - 使用 rAF 调度
  - `execution_timer_id` 被置为 `-1` 作为哨兵
- 否则使用 `setInterval`

每次 step 的固定外层顺序是：

1. `onBeforeStep?.()`
2. `runStep(1, !catch_errors)`
3. `onAfterStep?.()`

启动/停止时还会触发：

- `onPlayEvent`
- `onStopEvent`
- `sendEventToAllNodes("onStart")`
- `sendEventToAllNodes("onStop")`

### 1.2 Canvas 渲染循环

由 `LGraphCanvasLifecycle.startRendering()` 驱动：

- 每帧调用 `draw()`
- `pause_rendering` 为 `false` 时才实际绘制
- `is_rendering` 为停止条件

渲染循环与 graph 执行循环互不嵌套，只通过 graph 状态和 dirty 标记协同。

---

## 2. 节点从注册到入图

### 2.1 注册

节点类型先进入 `LiteGraphRegistry`：

```ts
LiteGraph.registerNodeType("category/name", NodeClass)
```

注册时会发生：

1. 写入 `NodeClass.type`
2. 从路径推导 `category`
3. 若无 `title`，使用类名
4. 把 `LGraphNode` 原型链方法补到目标节点原型上
5. 写入：
   - `registered_node_types`
   - `Nodes`
   - 可能的 `node_types_by_file_extension`
6. 若开启 `auto_load_slot_types`
   - 临时实例化节点
   - 自动登记输入/输出 slot 类型

### 2.2 创建

```ts
const node = LiteGraph.createNode(type, title?, options?)
```

创建时会补齐默认状态：

- `type`
- `title`
- `properties`
- `properties_info`
- `flags`
- `size`
- `pos`
- `mode`

最后触发：

- `node.onNodeCreated?.()`

### 2.3 入图

`graph.add(node)` 的主路径是：

1. 校正/分配节点 ID
2. `node.graph = graph`
3. 放入 `_nodes` 与 `_nodes_by_id`
4. `node.onAdded?.(graph)`
5. 若 `config.align_to_grid`，执行 `node.alignToGrid()`
6. `updateExecutionOrder()`，除非 `skip_compute_order === true`
7. `invokeGraphOnNodeAddedCompatHook(...)`
8. `setDirtyCanvas(true)`
9. `change()`

分组入图是更轻的一条支路：

- 只进入 `_groups`
- 设置 `group.graph`
- 标脏并 `change()`

---

## 3. 连接与断开流程

### 3.1 建立连接

`node.connect(slot, target, targetSlot)` 的真实步骤是：

1. 解析源输出槽
   - `slot` 可以是索引，也可以是名字
2. 解析目标输入槽
   - `targetSlot` 可以是索引、名字，或 `EVENT`
   - 当 `targetSlot === LiteGraph.EVENT` 且 `do_add_triggers_slots === true` 时，会先把目标节点切到 `ON_TRIGGER`，再自动寻找/创建 `onTrigger`
3. 调用目标预处理钩子
   - `target.onBeforeConnectInput?.(...)`
4. 校验类型兼容
   - `LiteGraph.isValidConnection(output.type, input.type)`
5. 调用连接钩子
   - `target.onConnectInput?.(...)`
   - `source.onConnectOutput?.(...)`
6. 必要时先断旧连接
   - 同一输入槽旧 link
   - 若输出为事件槽且 `allow_multi_output_for_events === false`，还会先断旧输出
7. 生成新 `LLink`
   - 默认用 `++graph.last_link_id`
   - `use_uuids` 打开时改用 `uuidv4()`
8. 写入三处核心结构
   - `graph.links[link.id] = link`
   - `output.links.push(link.id)`
   - `input.link = link.id`
9. 回调与同步
   - `source.onConnectionsChange(...)`
   - `target.onConnectionsChange(...)`
   - `graph.onNodeConnectionChange(...)`
   - `graph.afterChange?.()`
   - `graph.connectionChange?.(...)`
   - `setDirtyCanvas(false, true)`

### 3.2 断开连接

`disconnectInput()` 与 `disconnectOutput()` 会：

- 清理 `input.link` / `output.links`
- 从 `graph.links` 删除对应 link
- 触发 `onConnectionsChange`
- 触发 `graph.onNodeConnectionChange`
- 触发 `graph.connectionChange`
- 重新标脏画布

---

## 4. 执行主路径

当前执行不是单一路径，而是两条并存：

- 计划执行路径：`runStep()`
- 事件触发路径：`trigger() / triggerSlot()`

### 4.1 `runStep()` 计划执行

`LGraphExecution.runStep(num?, do_not_catch_errors?, limit?)` 的主逻辑：

1. 更新 `globaltime`
2. 选择执行列表
   - 优先 `_nodes_executable`
   - 否则退回 `_nodes`
3. 对每个节点：
   - 若启用 `use_deferred_actions` 且节点有 `_waiting_actions`，先 `executePendingActions()`
   - 若 `node.mode === ALWAYS && node.onExecute`，执行节点
4. step 完成后推进：
   - `fixedtime`
   - `execution_time`
   - `elapsed_time`
   - `iteration`
5. 清空：
   - `nodes_executing`
   - `nodes_actioning`
   - `nodes_executedAction`

### 4.2 当前实现里的一个重要细节

`runStep()` 在两个分支里的行为并不完全一样：

- `do_not_catch_errors === true`
  - 调用 `node.doExecute()`
- `do_not_catch_errors === false`
  - 直接调用 `node.onExecute()`

而 `graph.start()` 传入的是 `!graph.catch_errors`，且 `graph.catch_errors` 默认值为 `true`。  
这意味着在默认设置下，计划执行路径通常直接走 `onExecute()`，不会经过 `doExecute()` 的那层 bookkeeping。

因此，下面这些执行态标记：

- `nodes_executing`
- `exec_version`
- `execute_triggered`
- `onAfterExecuteNode`

在当前代码里对“计划执行路径”不是无条件生效的；它们在以下场景更可靠：

- `graph.catch_errors === false`
- 事件触发进入 `doExecute()`

这是当前实现事实，文档需要如实记录。

---

## 5. 事件触发路径

### 5.1 `trigger()`

`node.trigger(action?, param?, options?)` 会：

1. 更新 `graph._last_trigger_time`
2. 遍历当前节点所有输出槽
3. 只挑出：
   - `output.type === LiteGraph.EVENT`
   - 且 `action` 名称匹配的槽
4. 对每个匹配槽调用 `triggerSlot(slot, ...)`

### 5.2 `triggerSlot()`

`triggerSlot()` 的真实行为是：

1. 校验输出槽与 link 列表
2. 更新时间：
   - `graph._last_trigger_time`
   - `link._last_time`
3. 找到目标节点
4. 根据目标节点模式分支：
   - `node.mode === ON_TRIGGER`
     - 若有 `onExecute`，调用 `node.doExecute(param, options)`
   - 否则若有 `onAction`
     - 若 `use_deferred_actions === true` 且目标节点同时存在 `onExecute`
       - 把 action 放进 `node._waiting_actions`
       - 等下一次 `runStep()` 先执行 `executePendingActions()`
     - 否则直接 `node.actionDo(...)`

### 5.3 `doExecute()` / `actionDo()`

这两个包装方法都会做执行态 bookkeeping：

- 生成 `action_call`
- 更新：
  - `graph.nodes_executing`
  - `graph.nodes_actioning`
  - `graph.nodes_executedAction`
- 更新：
  - `exec_version`
  - `execute_triggered`
  - `action_triggered`
- 最后触发 `onAfterExecuteNode`

也正因为如此，事件路径比默认的计划执行路径保留了更多执行痕迹。

---

## 6. 执行序与拓扑排序

`updateExecutionOrder()` 的职责是：

1. 调用 `computeExecutionOrder(false)`
2. 把结果写入 `_nodes_in_order`
3. 从中筛出带 `onExecute` 的节点，写入 `_nodes_executable`

`computeExecutionOrder()` 采用 Kahn 风格逻辑：

1. 统计每个节点剩余输入连线数
2. 入度为 0 的节点入队
3. 逐步弹出并减少后继节点入度
4. 最后把环上的未处理节点追加到结果尾部
5. 结合 `priority` 与构造器 `priority` 排序
6. 回写 `order`

该执行序会在以下时机刷新：

- `graph.add(...)`
- `graph.remove(...)`
- `graph.connectionChange(...)`
- `deserializeGraphData(...)`

---

## 7. Graph 与 Canvas 的同步

### 7.1 Graph 侧发通知

当前 graph 与 canvas 的通信主要依赖：

- `sendActionToCanvas(action, params?)`
- `change()`
- `setDirtyCanvas(fg, bg?)`
- `beforeChange()`
- `afterChange()`
- `connectionChange()`

其中：

- `change()` 会调用 `sendActionToCanvas("setDirty", [true, true])`
- `setDirtyCanvas(fg, bg)` 会调用 `sendActionToCanvas("setDirty", [fg, bg])`
- `beforeChange()` / `afterChange()` 还会广播给 canvas 对应 hook

### 7.2 Canvas 侧消费 dirty 标记

`LGraphCanvasLifecycle.setDirty(fg, bg)` 只负责写：

- `dirty_canvas`
- `dirty_bgcanvas`

然后由 render loop 在 `draw()` 里决定：

- 是否重绘背景层 `drawBackCanvas()`
- 是否重绘前景层 `drawFrontCanvas()`

### 7.3 最近触发的视觉反馈

`draw()` 在下面这个时间窗内会强制考虑背景重绘：

- `graph._last_trigger_time` 距离当前不足 1000ms

这就是 link 高亮等“刚触发过”的视觉反馈基础。

---

## 8. 子图切换

Canvas 生命周期里还维护了一条子图导航链：

- `openSubgraph(graph)`
- `closeSubgraph()`
- `_graph_stack`

切换子图时会：

1. `clear()` 当前画布态
2. 把旧 graph 压栈
3. `graph.attachCanvas(this)`
4. `checkPanels()`
5. `setDirty(true, true)`

返回父图时会：

1. 弹出 `_graph_stack`
2. 重新 attach 父 graph
3. 恢复选中与视口状态
4. `setDirty(true, true)`

---

## 9. 一步执行时序图

```mermaid
sequenceDiagram
    participant Loop as "Graph.start / runStep"
    participant NodeA as "Source Node"
    participant NodeB as "Target Node"
    participant Graph as "LGraph"
    participant Canvas as "LGraphCanvas"

    Loop->>Graph: runStep(1, !catch_errors)
    loop each executable node
        Loop->>NodeA: executePendingActions()
        alt mode == ALWAYS
            alt do_not_catch_errors == true
                Loop->>NodeA: doExecute()
            else
                Loop->>NodeA: onExecute()
            end
        end
    end
    NodeA->>NodeA: trigger()/triggerSlot()
    alt target.mode == ON_TRIGGER
        NodeA->>NodeB: doExecute(param, options)
    else target.onAction
        alt deferred actions enabled
            NodeA->>NodeB: enqueue _waiting_actions
        else
            NodeA->>NodeB: actionDo(...)
        end
    end
    Graph->>Canvas: sendActionToCanvas("setDirty", [fg,bg])
    Canvas->>Canvas: drawBackCanvas() / drawFrontCanvas()
```

---

## 10. 关键源码

- `src/ts-migration/models/LGraph.lifecycle.ts`
- `src/ts-migration/models/LGraph.execution.ts`
- `src/ts-migration/models/LGraph.structure.ts`
- `src/ts-migration/models/LGraph.io-events.ts`
- `src/ts-migration/models/LGraph.persistence.ts`
- `src/ts-migration/models/LGraphNode.execution.ts`
- `src/ts-migration/models/LGraphNode.connect-geometry.ts`
- `src/ts-migration/canvas/LGraphCanvas.lifecycle.ts`
- `src/ts-migration/canvas/LGraphCanvas.render.ts`
