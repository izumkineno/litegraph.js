# RBush 替换 TODO 清单

## 结论

`rbush` 在这个工程里最值得替换的，不是零散的几何工具函数，而是几类“反复对大量矩形做线性扫描”的热点：

1. 节点空间索引
2. 分组空间索引
3. 分组内部节点重算
4. 连线粗裁剪与连线交互命中

优先级上，应该先做 **节点索引**，再做 **分组索引**，最后才考虑 **连线索引**。  
原因很直接：节点索引一旦建立，`getNodeOnPos`、`computeVisibleNodes`、框选、多处输入热路径会一起受益；而连线索引维护成本最高，最容易把复杂度转移成一致性 bug。

本文默认以 `src/ts-migration` 为主实施位点。`src/litegraph.js` 里存在几乎一一对应的 legacy 镜像热点，放在文末附录。

---

## RBush 适配前提

`rbush` 只适合解决“二维包围盒搜索 / 碰撞粗筛”的问题，不适合接管：

- slot 级别的小范围命中
- 键盘、复制粘贴、文件拖拽
- 节点内部 widget 交互
- 需要保留拓扑顺序语义的执行逻辑

对本工程来说，`rbush` 最合理的角色是：

- 用矩形索引先把候选集从 `O(n)` 缩到 `O(log n + k)`
- 然后继续复用现有的 `isPointInside` / `getBounding` / `overlapBounding` 做精判

也就是说，`rbush` 适合做“粗过滤器”，不适合直接替代业务判定本身。

---

## 总览表

| 优先级 | 替换包 | 主要入口 | 为什么能替换 | 替换规模 | 难度 | 主要风险 |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | 节点空间索引 | `models/LGraph.structure.ts:415` `canvas/LGraphCanvas.input.ts:1844` | 现状是反复遍历全量节点或可见节点做 bbox/point 命中 | 大 | 高 | 拖拽期间索引更新频率高；必须保留 z-order 和 `isPointInside` 语义 |
| P1 | 分组空间索引 | `models/LGraph.structure.ts:450` `canvas/LGraphCanvas.render.ts:1943` | group 也在做线性 point/bbox 扫描，语义稳定、结构简单 | 中 | 中 | group 边界更新点分散，容易产生陈旧索引 |
| P1 | 分组内部节点重算 | `models/LGraphGroup.ts:150` | 当前每次 group 交互都可能扫描所有节点判定 overlap | 中 | 中 | 依赖节点索引先落地，否则收益有限 |
| P2 | 连线空间索引 | `canvas/LGraphCanvas.render.ts:1243` `canvas/LGraphCanvas.input.ts:485` | 连线绘制前和 hover/click 都在扫大量 link | 大 | 很高 | link bbox/center 在节点移动、折叠、slot 变化后很容易失效 |
| P3 | 可见 group / 可见 link 专用快照索引 | `canvas/LGraphCanvas.render.ts:1943` `canvas/LGraphCanvas.render.ts:1362` | 可以作为渲染帧级临时索引进一步降扫描 | 中 | 中高 | 每帧重建如果策略不当，会把 CPU 从扫描转成建树 |

---

## 详细清单

## 1. 节点空间索引

### 当前命中点

- `src/ts-migration/models/LGraph.structure.ts:415`
  - `getNodeOnPos(x, y, nodes_list?, margin?)`
  - 现状是倒序遍历 `nodes_list` 或 `this._nodes`，逐个调用 `isPointInside`
- `src/ts-migration/canvas/LGraphCanvas.input.ts:236`
  - `processMouseDown` 中点选节点
- `src/ts-migration/canvas/LGraphCanvas.input.ts:680`
  - `processMouseMove` 中 hover/拖拽节点
- `src/ts-migration/canvas/LGraphCanvas.input.ts:949`
  - `processMouseUp` 中选择逻辑
- `src/ts-migration/canvas/LGraphCanvas.input.ts:1089`
  - 连线拖拽结束时的落点节点判定
- `src/ts-migration/canvas/LGraphCanvas.input.ts:1475`
  - drop 后根据鼠标位置找节点
- `src/ts-migration/canvas/LGraphCanvas.input.ts:1844`
  - `computeVisibleNodes()` 每帧遍历全量节点，用 `overlapBounding(this.visible_area, n.getBounding(...))` 做可见裁剪
- `src/ts-migration/canvas/LGraphCanvas.input.ts:951`
  - 框选结束时再次遍历 `graph._nodes`，逐个 `getBounding` + `overlapBounding`
- `src/ts-migration/canvas/LGraphCanvas.render.ts:179`
  - 渲染阶段消费 `computeVisibleNodes()` 的结果

### 为什么适合用 `rbush`

这是工程里最标准的空间索引场景：

- 数据是稳定的 2D 矩形包围盒
- 查询类型很明确：
  - 点查：鼠标点命中哪个节点
  - 框查：哪些节点与矩形相交
  - 视口查：哪些节点进入当前 `visible_area`
- 这些查询现在都在反复扫 `graph._nodes`

如果用 `rbush` 建一个节点 bbox 索引：

- `getNodeOnPos` 可以先 `search({minX:x-margin, minY:y-margin, maxX:x+margin, maxY:y+margin})`
- `computeVisibleNodes` 可以直接 `search(visibleBBox)`
- 框选可以直接 `search(dragRectBBox)`

这一个索引包能覆盖最多调用点，收益最大。

### 建议索引结构

```ts
type NodeBBoxItem = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  nodeId: string;
  node: LGraphNodeLike;
  zIndex: number;
};
```

关键点：

- `node` 或 `nodeId` 二选一都行，但建议都留
- 额外保留 `zIndex` 或原始数组顺序信息，用于恢复“顶层节点优先”的现有行为

### 替换规模

**规模：大**

至少会影响这些文件：

- `src/ts-migration/models/LGraph.structure.ts`
- `src/ts-migration/canvas/LGraphCanvas.input.ts`
- `src/ts-migration/canvas/LGraphCanvas.render.ts`
- `src/ts-migration/models/LGraph.lifecycle.ts`
- `src/ts-migration/models/LGraph.persistence.ts`
- `src/ts-migration/models/LGraphNode.canvas-collab.ts`
- 可能还要补一个新的 `services` / `core` 索引服务，例如 `graph-spatial-index.ts`

### 替换难度

**难度：高**

难点不在 `rbush` API，而在索引维护：

- `graph.add/remove/clear/configure` 要同步更新
- 节点拖拽移动时要更新 bbox
- 多选拖拽时会一次移动多节点
- 节点 collapse/expand、resize、widget 导致的 `onBounding` 变化也要更新

### 替换后可能出现的问题

1. **z-order 被破坏**
   - 现在 `getNodeOnPos` 倒序遍历数组，本质是在依赖绘制顺序
   - `rbush.search()` 只返回相交集合，不保证你想要的“最上层”
   - 必须在候选集里再按 `zIndex` 或 `_nodes` 顺序做一次筛选

2. **命中语义变化**
   - `rbush` 查的是 bbox
   - 现在节点命中判定用的是 `node.isPointInside(...)`
   - 不能把 `rbush` 结果直接当最终命中，必须保留精判

3. **拖拽期间更新开销反向吞掉收益**
   - 如果每次 `mousemove` 都对几十个节点做 `remove + insert`，收益可能被抵消
   - 更稳妥的方案是：
     - 拖拽中局部增量更新
     - 或拖拽结束后 `load()` / 批量重建

4. **自定义节点的 `onBounding` 失效**
   - 有些节点 bbox 不是单纯 `pos + size`
   - 索引更新时必须走统一 `getBounding(temp, true)`，不能手写几何

### 实施建议

这是最该先做的 `rbush` 位点。  
如果只做一件事，就先落这个。

---

## 2. 分组空间索引

### 当前命中点

- `src/ts-migration/models/LGraph.structure.ts:450`
  - `getGroupOnPos(x, y)` 倒序遍历 `_groups`，逐个 `isPointInside`
- `src/ts-migration/canvas/LGraphCanvas.input.ts:503`
  - `processMouseDown` 时找鼠标下的 group
- `src/ts-migration/canvas/LGraphCanvas.render.ts:1943`
  - 画 group 前用 `overlapBounding(this.visible_area, group._bounding)` 做线性裁剪

### 为什么适合用 `rbush`

group 的几何模型比 node 更简单：

- 输入是稳定矩形 `_bounding`
- 查询是点查和视口 bbox 查
- group 数量通常少于 node，但在复杂编辑场景里仍然会被频繁访问

这类对象很适合单独挂一个 `groupTree.search(...)`。

### 替换规模

**规模：中**

主要影响：

- `src/ts-migration/models/LGraph.structure.ts`
- `src/ts-migration/canvas/LGraphCanvas.input.ts`
- `src/ts-migration/canvas/LGraphCanvas.render.ts`
- `src/ts-migration/models/LGraphGroup.ts`

### 替换难度

**难度：中**

原因：

- group bbox 本身已有 `_bounding`
- 不像 node 那样依赖大量动态 `onBounding`
- 维护点比 node 少

### 替换后可能出现的问题

1. **group 嵌套 / 覆盖顺序被破坏**
   - 现在同样依赖倒序遍历返回“最上层 group”
   - `rbush` 命中后要再按 `_groups` 顺序取顶层

2. **resize / drag 后索引陈旧**
   - `selected_group` 的拖拽和 resize 在 `LGraphCanvas.input.ts` 里更新
   - group 移动后必须同步更新索引，否则 hover/click 会漂移

3. **收益上限有限**
   - 如果 group 数量始终很少，单独做 groupTree 的收益不会像 nodeTree 那么大

### 实施建议

如果已经做了节点索引，group 索引可以紧接着做。  
它不难，而且能把 group 命中和 group 渲染裁剪都顺手拿下。

---

## 3. 分组内部节点重算

### 当前命中点

- `src/ts-migration/models/LGraphGroup.ts:150`
  - `recomputeInsideNodes()`
  - 当前逻辑是遍历 `graph._nodes`，逐个 `getBounding` 后用 `overlapBounding(this._bounding, node_bounding)` 过滤
- `src/ts-migration/canvas/LGraphCanvas.input.ts:522`
  - 点击 group 且不是 resize 时会调用 `this.selected_group.recomputeInsideNodes()`

### 为什么适合用 `rbush`

这个逻辑本质上就是：

- 给定一个 group bbox
- 查所有和它相交的 node bbox

这正是 `rbush.search(groupBBox)` 的标准用法。

### 替换规模

**规模：中**

如果节点索引已经存在，这一项的实际改动很小：

- `src/ts-migration/models/LGraphGroup.ts`
- 节点索引服务暴露一个 `searchNodesByBBox()` 即可

如果节点索引不存在，这项几乎没有独立落地价值。

### 替换难度

**难度：中**

难点主要在依赖关系，不在算法：

- `LGraphGroup` 不应直接知道 `rbush`
- 更合理的做法是从 graph 或索引服务拿一个查询口

### 替换后可能出现的问题

1. **语义从“相交”误改成“完全包含”**
   - 当前逻辑是 `overlapBounding`
   - 不是“节点完全落在 group 内”
   - 新实现必须保留这个粗语义

2. **group 自身移动后查询窗口失配**
   - `_bounding` 改了，但 group 索引或 node 索引没刷新，就会出错

3. **如果 nodeTree 采用延迟更新，group 内节点列表可能短暂滞后**
   - 这对拖拽中高亮或菜单行为会产生肉眼可见问题

### 实施建议

把它当成 **节点索引落地后的附带收益**，不要单独立项。

---

## 4. 连线空间索引

### 当前命中点

- `src/ts-migration/canvas/LGraphCanvas.render.ts:1243`
  - `drawConnections()` 当前会遍历所有节点、所有输入 slot，计算 link 的粗 bbox，再和 `margin_area` 做 `overlapBounding`
- `src/ts-migration/canvas/LGraphCanvas.render.ts:1362`
  - `renderLink()` 里把每条实际绘制过的 link push 进 `visible_links`
- `src/ts-migration/canvas/LGraphCanvas.input.ts:485`
  - `processMouseDown` 遍历 `visible_links`，靠 `link._pos` 中心点附近 8x8 区域判定是否点到 link 中点菜单
- `src/ts-migration/canvas/LGraphCanvas.input.ts:796`
  - `processMouseMove` 遍历 `visible_links`，判断 hover 的 `over_link_center`

### 为什么适合用 `rbush`

理论上它很适合：

- link 也能抽象成 bbox
- 查询类型也明确：
  - 视口相交：决定哪些连线要画
  - 点查：鼠标是否靠近连线中心 handle

但它比 node/group 难很多，因为 link 的几何不是稳定矩形，而是依赖两端节点、slot、方向、折叠状态的动态曲线。

### 替换规模

**规模：大**

可能影响：

- `src/ts-migration/canvas/LGraphCanvas.render.ts`
- `src/ts-migration/canvas/LGraphCanvas.input.ts`
- `src/ts-migration/models/LGraphNode.connect-geometry.ts`
- `src/ts-migration/models/LGraph.structure.ts`
- `src/ts-migration/models/LGraph.persistence.ts`
- 可能新增 `link-spatial-index.ts`

### 替换难度

**难度：很高**

### 替换后可能出现的问题

1. **bbox 失真**
   - 现在用的是“端点包围盒”做粗裁剪
   - 真正的 Bezier 曲线可能略微超出这个区域
   - 如果索引实现过于精简，可能把本来应该显示/命中的 link 裁掉

2. **索引更新点过多**
   - 节点移动
   - 节点 collapse / expand
   - slot 增删 / 方向变化
   - 连接建立 / 断开
   - graph configure / paste / clone
   - 这些都会影响 link bbox

3. **`visible_links` 的生成时机变化**
   - 现在 `visible_links` 是渲染顺手产生的
   - 如果改成索引查询，输入层和渲染层谁拥有这份列表要重新界定

4. **hover/click 中点判定可能出现滞后**
   - `link._pos` 在 `renderLink()` 中更新
   - 如果输入先于一次完整重绘发生，中心点索引会过期

### 实施建议

这是 **可以做，但不该早做** 的位点。  
只有在节点索引、group 索引都已经稳定且大型图仍然卡在 link 渲染/交互上时，才值得推进。

---

## 5. 可见 link / 可见 group 的帧级快照索引

### 当前命中点

- `src/ts-migration/canvas/LGraphCanvas.render.ts:1943`
  - 每帧遍历 `_groups` 做视口 overlap
- `src/ts-migration/canvas/LGraphCanvas.render.ts:1362`
  - 每帧重建 `visible_links`
- `src/ts-migration/canvas/LGraphCanvas.input.ts:485`
  - 输入层消费 `visible_links`

### 为什么可以替换

如果后续已经有 node/group/link 的持久索引，那么可以考虑在每一帧渲染开始时：

- 用视口 bbox 查出“本帧可见对象”
- 生成轻量快照，输入和渲染共用

这不是新的索引类型，而是已有索引的使用方式优化。

### 替换规模

**规模：中**

### 替换难度

**难度：中高**

### 替换后可能出现的问题

1. **每帧建树是错误方向**
   - 如果把“帧级快照”误做成“每帧重建 rbush”，CPU 只会从扫描转成建树
   - 正确做法是查询持久索引，而不是每帧重新建一个新树

2. **输入/渲染快照时序不一致**
   - 如果输入用旧快照、渲染用新快照，hover 和画面会错位

### 实施建议

这不是第一阶段任务。  
只有在持久索引已经存在时，这项才有意义。

---

## 不建议用 `rbush` 替换的区域

下面这些地方虽然也在做几何判断，但不值得上 `rbush`：

### 1. slot 命中

- `src/ts-migration/canvas/LGraphCanvas.input.ts:1203`
  - `isOverNodeInput`
- `src/ts-migration/canvas/LGraphCanvas.input.ts:1229`
  - `isOverNodeOutput`
- `src/ts-migration/models/LGraphNode.connect-geometry.ts:235`
  - `getSlotInPosition`

原因：

- 这是“已经命中节点之后”的小范围局部循环
- 循环长度是单节点的 input/output 数量，不是全图规模
- 用 `rbush` 反而会把局部判断复杂化

### 2. 选中节点集合上的批量操作

- `src/ts-migration/canvas/LGraphCanvas.input.ts:833`
- `src/ts-migration/canvas/LGraphCanvas.static.ts:797`
- `src/ts-migration/canvas/LGraphCanvas.static.ts:1197`

原因：

- 这些逻辑只遍历 `selected_nodes`
- 复杂度取决于用户选择规模，不是图全量对象

### 3. 纯几何工具函数

- `src/ts-migration/utils/math-geometry.ts`

原因：

- `isInsideRectangle` / `overlapBounding` 是基础算子
- 即便引入 `rbush`，这些函数也还会继续存在，作为精判逻辑使用

---

## 建议的实施顺序

### 第 1 步：节点索引

目标：

- 替换 `getNodeOnPos`
- 替换 `computeVisibleNodes`
- 替换框选中的全量节点扫描

成功标准：

- 鼠标命中、框选、拖拽、drop、可见节点绘制全部行为不变
- 大图下 `processMouseDown` / `processMouseMove` / 每帧 `computeVisibleNodes` 耗时下降

### 第 2 步：分组索引

目标：

- 替换 `getGroupOnPos`
- 替换 group 绘制前的可见裁剪

### 第 3 步：让 `LGraphGroup.recomputeInsideNodes()` 复用节点索引

目标：

- 不再扫全量 `graph._nodes`
- 只查 group bbox 命中的节点

### 第 4 步：谨慎评估连线索引

目标：

- 只有在真实 benchmark 显示 link 扫描是瓶颈时才做

硬门槛：

- 必须先定义 link bbox 更新责任
- 必须证明不会破坏 link hover / link menu / drawConnections 一致性

---

## 建议的数据结构草案

### 节点索引

```ts
type NodeBBoxItem = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  nodeId: string;
  node: LGraphNodeLike;
  zIndex: number;
};
```

### 分组索引

```ts
type GroupBBoxItem = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  groupId: string;
  group: LGraphGroupLike;
  zIndex: number;
};
```

### 连线索引

```ts
type LinkBBoxItem = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  linkId: string;
  link: LLinkLike;
  centerX: number;
  centerY: number;
};
```

---

## 关键实现提醒

根据 RBush 官方文档，项目后续如果真的接入，最该利用的是这些能力：

- `insert` / `remove`
  - 适合交互期的增量维护
- `load`
  - 适合 `configure()`、大批量 paste、全量 rebuild
- `search`
  - 适合视口查、框选查
- `collides`
  - 适合只关心“是否有命中”的快速短路

实现时要注意：

1. `remove` 默认按对象引用删除
   - 必须保留同一个 index item 对象，或提供等值比较函数
2. 不要把 `rbush` 直接塞进 `models` 每个类里
   - 更合理的是挂在 graph 级服务或索引服务层
3. 不要把 `rbush` 结果直接当最终命中
   - 必须保留现有精判逻辑

参考：

- [RBush GitHub README](https://github.com/mourner/rbush)
- [RBush npm](https://www.npmjs.com/package/rbush)

---

## 最终建议

如果只选一个落地位点，选 **节点空间索引**。  
如果要排一个严肃的重构顺序，按下面来：

1. 节点空间索引
2. 分组空间索引
3. 分组内部节点重算复用节点索引
4. 连线空间索引

不要反过来。  
先做 link tree，只会先碰到最难维护、最容易出错的部分。

---

## 附录：legacy 单文件的镜像热点

如果后续要把同样的优化回刷到 legacy 单文件实现，基本对应关系如下：

- `src/litegraph.js:1776`
  - `LGraph.prototype.getNodeOnPos`
- `src/litegraph.js:1804`
  - `LGraph.prototype.getGroupOnPos`
- `src/litegraph.js:6118`
  - `processMouseDown` 中节点命中
- `src/litegraph.js:6624`
  - `processMouseMove` 中节点命中
- `src/litegraph.js:6912`
  - `processMouseUp` 中节点命中 / 框选
- `src/litegraph.js:7949`
  - `computeVisibleNodes`
- `src/litegraph.js:9535`
  - `drawConnections`
- `src/litegraph.js:10481`
  - group 可见裁剪

结论和 TS 迁移版一致，只是 legacy 里所有热点都挤在同一个文件里。
