# Scene Graph Sync Spec

本文档定义领域模型 `LGraph / LGraphNode / LLink` 到 Leafer 视图模型 `UI / Group / Path` 的单向同步规范。

核心目标：

1. 禁止在渲染函数里遍历 graph 结构做 diff。
2. 所有视图增删改都必须由“模型变更事件”驱动。
3. 节点与连线只做局部同步，不触发无关对象重算。

---

## 0. Discovery 结论

### 0.1 当前图结构的现成钩子

从 [LGraph.structure.ts](E:/Code/litegraph.js/src/ts-migration/models/LGraph.structure.ts) 可以确认：

1. `add(node)` 是节点进入图结构的主入口。
2. `remove(node)` 是节点离开图结构的主入口。
3. graph 暴露了：
   - `onNodeAdded?: (node) => void`
   - `onNodeRemoved?: (node) => void`
4. `add(node)` 在以下时机完成节点接入：
   - 分配 `node.id`
   - `node.graph = this`
   - push 到 `_nodes`
   - 写入 `_nodes_by_id`
   - `node.onAdded(this)`
   - `updateExecutionOrder()`
   - `onNodeAdded(node)`
   - `change()`
5. `remove(node)` 会先断开该节点所有输入输出，再：
   - `node.onRemoved()`
   - 从 `_nodes` / `_nodes_by_id` 移除
   - `onNodeRemoved(node)`
   - `change()`

这意味着：

- 节点 add/remove 已经有明确的结构化钩子，不需要依赖 `change()` 做全图 diff。

### 0.2 当前图 IO / 广播层的现成钩子

从 [LGraph.io-events.ts](E:/Code/litegraph.js/src/ts-migration/models/LGraph.io-events.ts) 可以确认：

1. `beforeChange(info?)`
2. `afterChange(info?)`
3. `connectionChange(node, link_info?)`
4. `change()`
5. `sendActionToCanvas(action, params?)`

graph 还暴露了：

- `onBeforeChange`
- `onAfterChange`
- `onConnectionChange`
- `on_change`

以及最关键的旧广播：

```ts
change() {
  this.sendActionToCanvas("setDirty", [true, true])
  if (this.on_change) this.on_change(this)
}
```

结论：

1. `change()` 只是 Canvas 时代的“匿名脏标记广播”。
2. `change()` 没有 mutation 粒度，不适合做 Leafer 结构同步主入口。
3. `beforeChange / afterChange` 更适合做批处理事务边界。

### 0.3 当前 link 的真实创建与销毁入口

虽然 graph 没有显式的 `addLink()` / `removeLink()` API，但 link 的生命周期是清晰的。

从 [LGraphNode.connect-geometry.ts](E:/Code/litegraph.js/src/ts-migration/models/LGraphNode.connect-geometry.ts) 可以确认：

#### link 创建

在 `connect(...)` 中：

1. 生成 `new LLink(...)`
2. 写入 `graph.links[link.id] = link_info`
3. 更新 output.links / input.link
4. `graph._version++`
5. `graph.onNodeConnectionChange?...`
6. `graph.connectionChange?.(this, link_info)`

#### link 删除

在 `disconnectOutput(...)` / `disconnectInput(...)` 中：

1. `delete graph.links[link_id]`
2. 同步 output.links / input.link
3. `graph._version++`
4. `graph.onNodeConnectionChange?...`
5. `graph.connectionChange?.(this)`

结论：

1. link 的主事实来源是 `graph.links` 这个对象。
2. connect/disconnect 路径会直接对 `graph.links` 做 `set / delete`。
3. `connectionChange(node, link?)` 粒度太粗，尤其 disconnect 时不一定带 `link_info`，不足以单独承担“link add/remove”同步。

### 0.4 当前节点位置变化没有统一广播

从 [LGraphNode.state.ts](E:/Code/litegraph.js/src/ts-migration/models/LGraphNode.state.ts) 可以确认：

1. `pos` 是裸 `Float32Array`
2. `set pos(v)` 只是写入 `_pos[0/1]`
3. 拖拽过程中大量代码直接执行：

```ts
node.pos[0] += dx
node.pos[1] += dy
```

这意味着：

1. `node.pos` 没有“位置变化事件”
2. 不能指望属性 setter 自动触发视图同步
3. 节点移动必须由交互控制器或命令层显式发出 `node:moved`

### 0.5 当前 node dirty 的真实问题

从 [LGraphNode.canvas-collab.ts](E:/Code/litegraph.js/src/ts-migration/models/LGraphNode.canvas-collab.ts) 可以确认：

```ts
setDirtyCanvas(fg, bg) {
  graph.sendActionToCanvas("setDirty", [fg, bg])
}
```

问题在于：

1. 这个广播没有 node id
2. 对 Leafer scene sync 来说，它只表达“某处脏了”
3. 它不能告诉我们“哪个 host 需要重画”

所以新的同步层不能把旧 `sendActionToCanvas("setDirty")` 当成唯一信息源，必须为 node dirty 增加结构化标识。

---

## 1. 总体架构

### 1.1 单向数据流

迁移后的同步链路必须是：

```text
LGraph / LGraphNode / LLink
  -> GraphMutationBus
  -> SceneSyncController
  -> NodeHost / LinkHost / Leafer Layer
  -> Leafer 自动渲染
```

严格禁止：

```text
draw()
  -> 遍历 graph._nodes / graph.links
  -> 现场生成或销毁 UI
```

### 1.2 关键运行时对象

```ts
type NodeId = number | string
type LinkId = number | string

interface SceneSyncStore {
  nodeHosts: Map<NodeId, NodeViewHost>
  legacyNodeHosts: Map<NodeId, LegacyNodeHost>
  modernNodeHosts: Map<NodeId, ModernNodeHost>
  linkHosts: Map<LinkId, LinkViewHost>
  linksByNodeId: Map<NodeId, Set<LinkId>>
  pendingNodeDirty: Set<NodeId>
  pendingLinkDirty: Set<LinkId>
  transactionDepth: number
}
```

### 1.3 Host 分层

```text
App
├─ tree.zoomLayer
│  ├─ legacyNodeLayer
│  ├─ modernNodeLayer
│  ├─ linkLayerBack
│  └─ linkLayerFront
└─ sky
   └─ overlay layers
```

约定：

1. `legacyNodeLayer` 只挂 `LegacyNodeHost.root`
2. `modernNodeLayer` 只挂 `ModernNodeHost.root`
3. `linkLayerBack` / `linkLayerFront` 只挂 `LinkViewHost.path`

---

## 2. Mutation Bus 规范

### 2.1 事件类型

```ts
type GraphMutation =
  | { type: 'node:add'; nodeId: NodeId; node: LGraphNode }
  | { type: 'node:remove'; nodeId: NodeId; node: LGraphNode }
  | { type: 'node:dirty'; nodeId: NodeId; fg: boolean; bg: boolean }
  | { type: 'node:moved'; nodeId: NodeId }
  | { type: 'link:add'; linkId: LinkId; link: LLink }
  | { type: 'link:remove'; linkId: LinkId; link: LLink }
  | { type: 'link:dirty'; linkId: LinkId }
  | { type: 'graph:begin'; reason?: string }
  | { type: 'graph:end'; reason?: string }
```

### 2.2 事件来源

推荐采用“现有 hooks + Proxy + method wrapper”的混合方案。

原因：

1. 节点 add/remove 已有 hook，直接复用成本最低。
2. link add/remove 没有 graph 级明确 hook，`graph.links` 又是主事实源，适合 Proxy。
3. node dirty 与 node moved 缺少结构化事件，必须 wrapper。

### 2.3 节点 add/remove 来源

直接绑定现有 graph hook：

```ts
graph.onNodeAdded = chain(graph.onNodeAdded, (node) => {
  bus.emit({ type: 'node:add', nodeId: node.id, node })
})

graph.onNodeRemoved = chain(graph.onNodeRemoved, (node) => {
  bus.emit({ type: 'node:remove', nodeId: node.id, node })
})
```

### 2.4 link add/remove 来源

推荐把 `graph.links` 包成 Proxy，而不是依赖 `connectionChange(node, link?)` 猜测。

```ts
function proxifyLinksMap(graph: LGraph, bus: GraphMutationBus) {
  const raw = graph.links
  graph.links = new Proxy(raw, {
    set(target, key, value) {
      const existed = Object.prototype.hasOwnProperty.call(target, key)
      target[key as keyof typeof target] = value
      if (!existed && value) {
        bus.emit({ type: 'link:add', linkId: key, link: value as LLink })
      }
      return true
    },
    deleteProperty(target, key) {
      const prev = target[key as keyof typeof target]
      if (prev) {
        bus.emit({ type: 'link:remove', linkId: key, link: prev as LLink })
      }
      return delete target[key as keyof typeof target]
    },
  })
}
```

这样可直接覆盖：

- `connect()` 里的 `graph.links[id] = link_info`
- `disconnectInput()` / `disconnectOutput()` 里的 `delete graph.links[id]`

优点：

1. 不需要在每条 connect/disconnect 分支上手工补事件
2. disconnect 时不会丢失被删除的 `link_id`
3. 结构同步层拿到的是“精确 link mutation”，而不是“某个节点连接变了”

### 2.5 事务边界来源

复用现有：

- `beforeChange()`
- `afterChange()`

```ts
graph.onBeforeChange = chain(graph.onBeforeChange, () => {
  bus.emit({ type: 'graph:begin' })
})

graph.onAfterChange = chain(graph.onAfterChange, () => {
  bus.emit({ type: 'graph:end' })
})
```

用途：

1. 在 remove node / reconnect 这类复合操作中批量收集 mutation
2. 在 `graph:end` 或 microtask flush 时统一更新 Leafer host

### 2.6 为什么 `change()` 不作为主入口

`change()` 只能告诉我们：

- “图看起来变了”

它不能告诉我们：

- 新增了哪个 node
- 删除了哪个 link
- 哪个 node 只是视觉变脏
- 哪些 link 需要 reroute

因此：

1. `change()` 不是 Scene Sync 的主入口
2. `change()` 只能作为 fallback invalidation signal

---

## 3. 同步时机

### 3.1 节点新增

当 bus 收到：

```ts
{ type: 'node:add', nodeId, node }
```

处理流程：

1. 通过 runtime discriminator 判断：
   - `legacy`
   - `modern`
2. 创建对应 host：
   - `LegacyNodeHost`
   - `ModernNodeHost`
3. 写入：
   - `nodeHosts.set(nodeId, host)`
   - `legacyNodeHosts.set(...)` 或 `modernNodeHosts.set(...)`
   - `linksByNodeId.set(nodeId, new Set())`
4. 把 `host.root` add 到对应 Leafer layer：
   - `legacyNodeLayer.add(host.root)`
   - 或 `modernNodeLayer.add(host.root)`

注意：

1. 这里做的是 Leafer scene tree 的增量 add
2. 绝不能等待下次 draw 时再扫描 graph 找“缺的节点”

### 3.2 节点删除

当 bus 收到：

```ts
{ type: 'node:remove', nodeId, node }
```

处理流程：

1. 从 `linksByNodeId.get(nodeId)` 拿到 incident link 集合
2. 先移除所有残留 `LinkViewHost`
3. 从 layer 中移除 `host.root`
4. 调用 `host.destroy()`
5. 清理：
   - `nodeHosts.delete(nodeId)`
   - `legacyNodeHosts.delete(nodeId)`
   - `modernNodeHosts.delete(nodeId)`
   - `linksByNodeId.delete(nodeId)`

虽然理论上 remove node 之前 disconnect 已会删 link，但删除节点时仍应做一次 adjacency 清理兜底，防止视图层残留。

### 3.3 link 新增

当 bus 收到：

```ts
{ type: 'link:add', linkId, link }
```

处理流程：

1. 创建 `LinkViewHost`
2. `linkHosts.set(linkId, host)`
3. 更新 adjacency：
   - `linksByNodeId.get(link.origin_id).add(linkId)`
   - `linksByNodeId.get(link.target_id).add(linkId)`
4. add 到 `linkLayerBack`
5. 立即调用一次 `host.updatePath(...)`

`updatePath(...)` 所需的起终点应通过 `NodePortAdapter` 获取，而不是从 Canvas renderer 里取缓存点。

### 3.4 link 删除

当 bus 收到：

```ts
{ type: 'link:remove', linkId, link }
```

处理流程：

1. `linkHosts.get(linkId)?.destroy()`
2. 从 `linkLayerBack` 移除对应 path
3. `linkHosts.delete(linkId)`
4. 从 adjacency 中移除：
   - `linksByNodeId.get(link.origin_id)?.delete(linkId)`
   - `linksByNodeId.get(link.target_id)?.delete(linkId)`

这一步必须由 link mutation 直接驱动，不能在 node redraw 时顺手重建整层 link。

---

## 4. 状态更新：Node Dirty -> Host 局部刷新

### 4.1 当前问题

旧 `setDirtyCanvas(true)` 只会走匿名 graph-canvas 广播，无法定位到具体 host。

因此迁移期必须加一层 node dirty bridge。

### 4.2 推荐做法

在 node add 时，对 node 实例做一次 method wrapper：

```ts
function wrapNodeDirty(node: LGraphNode, bus: GraphMutationBus) {
  const original = node.setDirtyCanvas?.bind(node)
  node.setDirtyCanvas = (fg: boolean, bg?: boolean) => {
    bus.emit({
      type: 'node:dirty',
      nodeId: node.id,
      fg,
      bg: !!bg,
    })
    original?.(fg, bg)
  }
}
```

重点：

1. 业务节点代码不改
2. 结构化 dirty 事件先发
3. 旧 Canvas 广播可暂时保留作过渡兼容

### 4.3 `node:dirty` 的消费规则

```ts
bus.on('node:dirty', ({ nodeId, fg, bg }) => {
  const host = store.nodeHosts.get(nodeId)
  if (!host) return

  if (fg) host.repaintVisual()
  if (bg) scheduleIncidentLinks(nodeId)
})
```

### 4.4 `setDirtyCanvas(true)` 的具体处理

这是用户最关心的路径。

当旧节点调用：

```ts
this.setDirtyCanvas(true)
```

同步层应执行：

1. 用 `Map<NodeId, LegacyNodeHost>` 找到 host
2. 调用：

```ts
legacyHost.repaintBitmap()
```

3. 不触发全图重建
4. 不触发全 link layer 遍历

也就是说：

```text
node.setDirtyCanvas(true)
  -> bus.emit(node:dirty)
  -> legacyNodeHosts.get(node.id)
  -> repaintBitmap()
  -> Leafer 自动渲染该 host 的局部变化
```

### 4.5 `fg` / `bg` 的新语义

迁移后建议把旧 dirty 标记重新解释为：

- `fg = true`
  - 节点自身视觉内容脏了
  - 需要刷新 host 的 UI / bitmap

- `bg = true`
  - 与节点相关的背景/连线/外壳几何可能受影响
  - 需要 reroute incident links

因此：

1. `setDirtyCanvas(true, false)` => 刷新节点 host
2. `setDirtyCanvas(false, true)` => 刷新 incident links
3. `setDirtyCanvas(true, true)` => 两者都做

---

## 5. 连线路由（极度重要）

### 5.1 原则

节点位置变化时，禁止：

1. 遍历 `graph.links`
2. 全量重建 `linkLayerBack`
3. 重算与该节点无关的 Path

必须做到：

1. 找到与该节点相连的 link 子集
2. 只更新这些 `LinkViewHost.path`

### 5.2 必须维护 adjacency index

```ts
linksByNodeId: Map<NodeId, Set<LinkId>>
```

维护规则：

1. `link:add` 时同时写入 origin / target 两端
2. `link:remove` 时同时从 origin / target 两端删除
3. `node:remove` 时清空该 node 的 adjacency 集

这个索引是局部 reroute 的前提。

### 5.3 节点移动事件来源

由于 `node.pos` 没有统一事件，节点移动不能靠属性监听。

必须由交互控制器显式发出：

```ts
bus.emit({ type: 'node:moved', nodeId })
```

典型来源：

1. 节点拖拽
2. 多选拖拽
3. group move
4. alignToGrid
5. 自动布局
6. deserialize / paste 后的显式定位

如果一次移动多个节点，应发多条 `node:moved`，但在 flush 层去重。

### 5.4 路由更新算法

```ts
function scheduleIncidentLinks(nodeId: NodeId) {
  const links = store.linksByNodeId.get(nodeId)
  if (!links) return
  for (const linkId of links) {
    store.pendingLinkDirty.add(linkId)
  }
}

function flushDirtyLinks(graph: LGraph) {
  for (const linkId of store.pendingLinkDirty) {
    const link = graph.links[String(linkId)]
    if (!link) continue

    const originHost = store.nodeHosts.get(link.origin_id)
    const targetHost = store.nodeHosts.get(link.target_id)
    const linkHost = store.linkHosts.get(linkId)

    if (!originHost || !targetHost || !linkHost) continue

    const from = originHost.portAdapter.getPortAnchor(link.origin_slot, false)
    const to = targetHost.portAdapter.getPortAnchor(link.target_slot, true)

    linkHost.updateEndpoints(from, to)
  }

  store.pendingLinkDirty.clear()
}
```

### 5.5 `NodePortAdapter` 是唯一端点真相

link reroute 不能依赖历史 Canvas 渲染缓存。

必须统一走：

```ts
interface NodePortAdapter {
  getPortAnchor(slot: number, isInput: boolean): { x: number; y: number }
  getPortBounds(slot: number, isInput: boolean): Bounds
}
```

具体实现：

1. `LegacyNodeHost.portAdapter`
   - 直接复用当前节点几何 `getConnectionPos()`

2. `ModernNodeHost.portAdapter`
   - 从 Leafer port UI 或 port proxy 几何得到锚点

这样可保证：

1. legacy / modern 节点混排时，link routing 逻辑不分叉
2. 视图层不会再碰 Canvas renderer 的内部状态

### 5.6 多节点拖拽时的去重

当一次拖拽移动多个节点时：

1. 不要每个节点移动一次就立即更新 link path
2. 应先把所有 `nodeId` 加入 dirty set
3. 再求 adjacency union
4. 对 union 后的 `linkId` 去重更新一次

也就是说：

```text
selected nodes moved
  -> pendingMovedNodes.add(nodeId)
  -> flush:
       union(linksByNodeId[nodeId])
       update each dirty link once
```

### 5.7 为什么 `connectionChange(node)` 不能单独承担 reroute

原因有 3 个：

1. 它只告诉我们“连接关系变了”，不告诉我们 disconnect 的具体 `linkId`
2. 它不是节点移动事件
3. 它过于 graph-canvas 时代，语义偏“重绘背景线层”

所以：

1. `connectionChange(node, link?)` 可作为“连接拓扑变化后刷新 adjacency / reroute”的辅助触发
2. 但 link identity 仍应以 `graph.links` Proxy 事件为准
3. 节点位置变化仍必须走 `node:moved`

---

## 6. 事务与批处理

### 6.1 为什么需要批处理

很多图操作不是单 mutation，而是 mutation 序列。

例如：

1. reconnect input
   - remove old link
   - add new link

2. remove node
   - remove N 条 incident links
   - remove node host

3. paste / deserialize
   - add many nodes
   - add many links

如果每一步都立刻更新 Leafer scene tree，会导致：

1. 无意义的重复 add/remove
2. 重复 reroute
3. 视觉闪烁

### 6.2 推荐 flush 策略

推荐“事务优先，microtask 保底”：

1. `graph:begin` 时 `transactionDepth++`
2. mutation 先入队
3. `graph:end` 时 `transactionDepth--`
4. 归零后统一 flush
5. 没有事务包裹时，走 `queueMicrotask(flush)`

### 6.3 flush 顺序

建议顺序：

1. `link:remove`
2. `node:remove`
3. `node:add`
4. `link:add`
5. `node:dirty`
6. `node:moved`
7. `link:dirty`

原因：

1. 先拆旧 link，避免悬挂引用
2. 再删 node
3. 再建 node
4. 再建 link
5. 最后做局部 reroute / repaint

---

## 7. 实施约束

### 7.1 必须遵守

1. render 阶段不扫描 `graph._nodes`
2. render 阶段不扫描 `graph.links`
3. 所有结构变化必须经过 `GraphMutationBus`
4. 所有局部 path 更新必须经过 `linksByNodeId` adjacency index

### 7.2 可以保留但不得主导

以下旧机制可以暂时保留兼容，但不能继续主导同步：

1. `graph.change()`
2. `graph.sendActionToCanvas("setDirty")`
3. `graph.connectionChange(node)`

### 7.3 最终单一真相

迁移完成后：

1. 领域模型真相：
   - `graph._nodes`
   - `graph._nodes_by_id`
   - `graph.links`

2. 视图映射真相：
   - `nodeHosts`
   - `linkHosts`
   - `linksByNodeId`

3. 同步真相：
   - `GraphMutationBus`

只要这三层分离清楚，Leafer scene tree 就能真正成为数据驱动视图，而不是 Canvas 重绘时代的副本。 
