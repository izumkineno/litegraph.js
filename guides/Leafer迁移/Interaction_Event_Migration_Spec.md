# Interaction Event Migration Spec

本文档定义从旧 `LGraphCanvas.input.ts + DragAndScale.ts` 输入系统迁移到 LeaferJS 事件系统后的交互规范。

范围只覆盖 4 条核心交互链路：

1. 画布平移与缩放
2. 节点选中与拖拽
3. 连线创建、重连与断开
4. 框选

补充说明：

- 右键菜单不属于 4 条主编辑链路之一，但属于必须保真的兼容链路。
- 因此本文在事件映射里会额外补充 `contextmenu` 的桥接规则。

本规范不修改业务代码，只定义迁移时的行为契约、事件映射和冒泡策略。

---

## 0. Discovery 摘要

### 0.1 本次核对的旧代码入口

- `src/ts-migration/canvas/LGraphCanvas.input.ts`
  - `processMouseDown()`
  - `processMouseMove()`
  - `processMouseUp()`
  - `processMouseWheel()`
  - `adjustMouseEvent()`
  - `setZoom()`
  - `processNodeSelected()`
  - `selectNodes()`
  - `deselectAllNodes()`
- `src/ts-migration/canvas/DragAndScale.ts`
  - `onMouse()`
  - `mouseDrag()`
  - `changeScale()`
  - `changeDeltaScale()`
  - `convertCanvasToOffset()`
  - `convertOffsetToCanvas()`
- `src/ts-migration/canvas/LGraphCanvas.render.ts`
  - `drawFrontCanvas()`
  - 临时连线 preview
  - `dragging_rectangle` 框选框

### 0.2 旧系统的真实交互模型

#### A. 画布平移与缩放

旧系统当前有 4 条入口：

1. 左键点击空白背景后，若 `allow_dragcanvas` 为真，则 `dragging_canvas = true`
2. 中键按下后，若 `allow_dragcanvas` 为真，则 `dragging_canvas = true`
3. 空格按下时，`dragging_canvas = true`
4. `wheel` 事件直接调用 `ds.changeScale(scale, [e.clientX, e.clientY])`

旧平移逻辑：

```ts
this.ds.offset[0] += delta[0] / this.ds.scale
this.ds.offset[1] += delta[1] / this.ds.scale
```

旧缩放逻辑：

```ts
scale *= 1.1
// or
scale *= 1 / 1.1
this.ds.changeScale(scale, [e.clientX, e.clientY])
```

`DragAndScale.ts` 中同样保留了一套旧 viewport 数学：

- `offset`
- `scale`
- `mouseDrag()`
- `changeScale()`
- `changeDeltaScale()`

这套 helper 在 Leafer 迁移后应被官方 viewport 模型替代，而不是继续作为主状态源。

#### B. 节点选中与拖拽

旧选中逻辑：

1. 点中节点后 `processNodeSelected(node, e)`
2. `shiftKey / ctrlKey / multi_select` 控制是否追加到当前选择集
3. `selectNodes()` 会同步：
   - `node.is_selected = true`
   - `selected_nodes`
   - `highlighted_links`

旧拖拽逻辑：

1. `processMouseDown()` 中若节点未被控件/双击/连线逻辑拦截，则 `this.node_dragged = node`
2. `processMouseMove()` 中遍历 `selected_nodes`，按 `delta / ds.scale` 移动所有节点
3. `processMouseUp()` 中：
   - 节点位置四舍五入
   - 可选 `alignToGrid()`
   - `graph.afterChange(this.node_dragged)`

#### C. 连线创建、重连与断开

旧连线起点：

1. 点中 output slot
   - `connecting_node = node`
   - `connecting_output = output`
   - `connecting_pos = node.getConnectionPos(false, i)`
2. 点中 input slot
   - `connecting_node = node`
   - `connecting_input = input`
   - `connecting_pos = node.getConnectionPos(true, i)`

旧断开 / 重连逻辑：

1. output slot 下按下断链修饰键时，可 `disconnectOutput(i)`
2. input slot 已有 link 时：
   - `click_do_break_link_to` 可直接 `disconnectInput(i)`
   - `allow_reconnect_links || e.shiftKey` 时，会先断开旧 link，再切换到“从旧源端继续拉线”的 reconnect 模式

旧预览与高亮逻辑：

1. `processMouseMove()` 中依赖：
   - `_highlight_input`
   - `_highlight_output`
   - `_highlight_input_slot`
2. `drawFrontCanvas()` 中用 `renderLink()` + `ctx.arc()/ctx.rect()` 画拖拽临时线

旧提交逻辑：

1. `processMouseUp()` 时，如果释放在目标节点上：
   - output 模式下走 `connect()` / `connectByType()`
   - input 模式下走 `node.connect()` / `connectByTypeOutput()`
2. 若释放在空白区：
   - `release_link_on_empty_shows_menu` 可打开 search box 或 connection menu

#### D. 框选

旧框选入口：

1. 左键按下且 `ctrlKey`
2. 创建 `dragging_rectangle = [startX, startY, 1, 1]`

旧更新逻辑：

1. `processMouseMove()` 中不断更新 `dragging_rectangle[2/3]`
2. `drawFrontCanvas()` 中直接 `ctx.strokeRect(...)`

旧完成逻辑：

1. `processMouseUp()` 时将负宽高翻转为标准包围盒
2. 用 `overlapBounding(dragging_rectangle, node_bounding)` 找交集
3. `selectNodes(to_select, e.shiftKey)` 完成框选

### 0.3 旧 `canvasX / canvasY` 的真实语义

这是迁移时最容易混淆的点。

旧系统在 `adjustMouseEvent()` 中定义：

```ts
e.canvasX = clientX_rel / this.ds.scale - this.ds.offset[0]
e.canvasY = clientY_rel / this.ds.scale - this.ds.offset[1]
```

所以旧 `canvasX / canvasY` 不是浏览器 `clientX / clientY`，也不是 Leafer 文档里的 `world` 坐标。

它更接近：

- Leafer 的 `page` 坐标
- 或“相对 `zoomLayer` 解算后的图坐标”

迁移时必须按这个语义对齐，否则节点拖拽、端口命中、框选都会偏。

---

## 1. 事件映射表

### 1.1 坐标总规则

先给出统一坐标规则：

| 旧字段 / 旧语义 | Leafer 替代 | 说明 |
| --- | --- | --- |
| `clientX / clientY` | `event.origin.clientX / clientY` | 浏览器原生坐标 |
| `canvasX / canvasY` | `event.getPagePoint()` | 对应旧图坐标，优先用 page 坐标 |
| 从原生事件直接换算旧 `canvasX / canvasY` | `app.getPagePointByClient({ clientX, clientY })` | 这是原生事件到旧图坐标的直接替代 |
| 从节点局部视角换算旧点击点 | `event.getLocalPoint(nodeRoot)` / `event.getInnerPoint(nodeRoot)` | 用于替代旧 `canvasX - node.pos[0]` 一类局部坐标 |
| 节点局部坐标 `pos = [canvasX - node.pos[0], canvasY - node.pos[1]]` | `event.getInnerPoint(nodeRoot)` | 节点内部坐标 |
| 节点本地偏移量 `delta / ds.scale` | `dragEvent.getPageMove()` | 节点位置在 page 坐标系中更新 |
| 视口平移的屏幕位移 | `dragEvent.moveX / moveY` | 直接用于修改 `zoomLayer.x / y` 或交给 viewport 插件 |

结论：

1. 节点、端口、框选一律以 `page` 坐标思考。
2. 画布平移以屏幕 / world 位移思考。
3. 只有需要节点局部命中时才转到 `inner/local`。

补充说明：

1. `getWorldPointByClient()` 返回的是 Leafer world 坐标，更适合做 viewport 平移、screen overlay 对齐。
2. 它不能直接等价旧 `canvasX / canvasY`。
3. 旧 `canvasX / canvasY` 的直接替代应优先是 `event.getPagePoint()` 或 `app.getPagePointByClient()`。

### 1.2 原生输入到 Leafer 的映射

| 旧交互入口 | 旧实现 | Leafer 事件 | 新坐标换算 | 迁移建议 |
| --- | --- | --- | --- | --- |
| `mousedown` 命中节点主体 | `processMouseDown()` + `processNodeSelected()` | `pointer.down` + `drag.start` | `event.getPagePoint()` / `event.getInnerPoint(nodeRoot)` | 节点 host 自己处理选中与拖拽起点 |
| `mousemove` 拖拽节点 | `node_dragged + delta / ds.scale` | `drag` | `dragEvent.getPageMove()` | 用 page move 直接更新 selected node 集合位置 |
| `mouseup` 结束节点拖拽 | `graph.afterChange(node)` | `drag.end` | 无需额外换算 | 统一在 drag.end 提交位置与吸附 |
| 左键空白区 `mousedown` | `dragging_canvas = true` 或 `dragging_rectangle` | `pointer.down` 或 `drag.start` on bgHitRect | `event.getPagePoint()` | 按 modifier 分流成框选或背景平移 |
| 中键 `mousedown` | `dragging_canvas = true` | `pointer.down` + `drag.start` on `bgHitRect` | `dragEvent.moveX / moveY` | 设计模式下作为背景平移快捷入口 |
| `mousemove` 背景平移 | `ds.offset += delta / scale` | `drag` on bgHitRect or viewport plugin | `dragEvent.moveX / moveY` | 更推荐交给 `@leafer-in/viewport` |
| `wheel` 缩放 | `ds.changeScale(scale, [clientX, clientY])` | `zoom.start/zoom/zoom.end` | pivot 用 `event.origin.clientX/Y` 或 `app.getPagePointByClient()` | 优先交给 `@leafer-in/viewport` 配置 |
| `mousedown` 命中 output/input slot | `connecting_* = ...` | `pointer.down` on PortProxy | `event.getPagePoint()` / `event.getInnerPoint(portProxy)` | 启动连接态，禁止冒泡 |
| `mousemove` 拉临时连线 | `renderLink(...)` | `pointer.move` on app/tree while connecting | `event.getPagePoint()` | 只更新 overlayWorld 上的 preview Path |
| `mouseup` 提交连线 | `connect() / connectByType()` | `pointer.up` | `event.getPagePoint()` | 通过 PortProxy 命中或几何查询完成连接 |
| `contextmenu` 命中节点或空白区 | `processContextMenu(node, e)` | DOM `contextmenu` + Leafer hit-test | 菜单定位看 `clientX / clientY`；命中计算看 `canvasX / canvasY` | 传给 legacy menu 的必须是原生 `MouseEvent` 兼容对象，不能是 plain object |
| `Ctrl + mousedown` 空白区 | `dragging_rectangle` | `drag.start` on bgHitRect | `dragEvent.getPageBounds()` | 启动框选态并显示 selectionRect |
| `mousemove` 框选中 | `strokeRect(...)` | `drag` | `dragEvent.getPageBounds()` | 更新 selectionRect，不再重画前景 canvas |
| `mouseup` 框选结束 | `overlapBounding(...)` | `drag.end` | `dragEvent.getPageBounds()` | 以 bounds 查询命中节点并更新 selection set |

### 1.3 viewport 专项说明

当前仓库已经有 `@leafer-in/viewport` 依赖，因此平移和缩放的主路径应优先切到官方插件。

推荐策略：

1. `wheel` / 触摸板 / 捏合：交给 `@leafer-in/viewport`
2. 中键拖拽 / 空格拖拽背景：用 background hit layer 驱动 viewport 或直接启用 design 风格视口配置
3. 不再让 `DragAndScale` 作为主 viewport 状态源

需要特别注意一处默认行为差异：

1. 旧 `processMouseWheel()` 是“普通滚轮直接缩放”
2. Leafer 官方 viewport 默认更偏向“滚轮/触摸板滚动平移，`Ctrl / Command + wheel` 才缩放”
3. 如果目标是 100% 保留旧行为，必须显式把 viewport 的 wheel 配置改成“滚轮直接缩放”

`DragAndScale.ts` 可以保留为兼容参考，但不应继续作为 Leafer 运行时的第一真相。

### 1.4 右键菜单专项规则

右键菜单链路与普通 pointer 交互有一个额外约束：

1. Leafer `pointer.down` 的右键分支只负责命中准备、选中同步和阻止错误冒泡。
2. 真正打开 legacy `ContextMenu` 的事件，应来自宿主 DOM 的 `contextmenu`。
3. 传给 legacy 菜单控制器的事件必须满足两组字段：
   - `clientX / clientY`
     用于菜单 DOM 浮层定位。
   - `canvasX / canvasY`
     用于 node / slot / group 命中。
4. 因此菜单桥接事件不能是普通对象，必须是原生 `MouseEvent` 或 `PointerEvent`，并在其上补挂 legacy 所需字段。

当前运行时结论：

1. 右键菜单、search box、dialog 仍是 DOM 浮层，不属于 Leafer `overlayScreen`。
2. `overlayScreen` 仍应保留为未来 Leafer 化屏幕层的目标结构，但当前不是菜单主路径。

---

## 2. 交互状态剥离

### 2.1 旧状态字段与新状态对象

旧系统把交互临时状态塞在 `LGraphCanvas` 实例里：

- `dragging_canvas`
- `dragging_rectangle`
- `connecting_node`
- `connecting_output`
- `connecting_input`
- `connecting_pos`
- `_highlight_input`
- `_highlight_output`

迁移后，建议统一剥离成独立的交互状态树：

```ts
interface InteractionState {
  mode: 'idle' | 'viewport-pan' | 'node-drag' | 'connecting' | 'box-select'
  pagePointer: { x: number; y: number } | null
  worldPointer: { x: number; y: number } | null
  connection: {
    fromNodeId?: string | number
    fromSlot?: number
    fromIsOutput?: boolean
    fromAnchor?: { x: number; y: number }
    hoverTarget?: { nodeId: string | number; slot: number; isInput: boolean } | null
  } | null
  selectionBox: {
    x: number
    y: number
    width: number
    height: number
  } | null
}
```

### 2.2 `sky.overlayWorld` 的职责

临时交互图形不再属于前景重绘逻辑，而是成为独立 UI 对象，挂到 `sky.overlayWorld`。

推荐结构：

```text
sky
├─ overlayWorld
│  ├─ connectionPreviewPath
│  ├─ connectionStartMarker
│  ├─ connectionHoverMarker
│  ├─ selectionBoxRect
│  └─ portHoverHalo
└─ overlayScreen
   ├─ contextMenus
   ├─ searchBox
   └─ tooltips
```

其中：

- `overlayWorld` 使用图坐标表达临时图形
- `overlayScreen` 使用屏幕坐标表达菜单、tooltip、搜索框

现状修正：

- 当前真正落地在 `overlayWorld` 的是世界空间临时交互图元。
- 当前右键菜单 / search box / dialog 仍由 DOM `floating-ui-service` 挂载到 document，不在 Leafer `overlayScreen` 中。
- 因此这里的 `overlayScreen` 应理解为目标态，而不是当前已完成实现。

### 2.3 `overlayWorld` 与 `zoomLayer` 的关系

因为临时连线和框选框都应跟节点世界对齐，`overlayWorld` 必须与 `tree.zoomLayer` 同步变换。

推荐策略：

1. `overlayWorld.x = tree.zoomLayer.x`
2. `overlayWorld.y = tree.zoomLayer.y`
3. `overlayWorld.scaleX = tree.zoomLayer.scaleX`
4. `overlayWorld.scaleY = tree.zoomLayer.scaleY`

也就是说：

- 节点在 `tree.zoomLayer`
- 临时交互图形在 `sky.overlayWorld`
- 二者视觉上对齐，但层级上 `overlayWorld` 永远压在节点之上

### 2.4 临时连线（Connection Preview）

旧实现：

- `drawFrontCanvas()` 每帧判断 `connecting_pos != null`
- 再用 `renderLink()` 画一条临时曲线

新实现：

1. 在 `pointer.down` 命中 `PortProxy` 时创建连接状态
2. 显示 `sky.overlayWorld.connectionPreviewPath`
3. 在 `pointer.move` 时重算 path data
4. 在 `pointer.up` 时：
   - 命中目标端口则提交连接
   - 未命中则隐藏 preview 并决定是否弹菜单

建议的 UI 形态：

- `connectionPreviewPath`: `UI.Path`
- `connectionStartMarker`: `UI.Ellipse` 或 `UI.Rect`
- `connectionHoverMarker`: `UI.Ellipse` 或 `UI.Rect`

重要规则：

1. preview Path 必须 `hittable = false`
2. preview Path 只作为视觉态，不参与命中
3. 目标命中统一靠节点 port proxy 或端口几何查询

### 2.5 框选矩形（Selection Box）

旧实现：

- `processMouseMove()` 改 `dragging_rectangle`
- `drawFrontCanvas()` 中 `ctx.strokeRect(...)`

新实现：

1. 背景层在满足框选条件时进入 `box-select`
2. 创建或显示 `sky.overlayWorld.selectionBoxRect`
3. 在 `drag` 中使用 `dragEvent.getPageBounds()` 更新：
   - `x`
   - `y`
   - `width`
   - `height`
4. 在 `drag.end` 中用该 bounds 做节点相交查询
5. 结束后隐藏 `selectionBoxRect`

建议的 UI 形态：

- `selectionBoxRect`: `UI.Rect`
- 样式：
  - 透明填充
  - 可见描边
  - `hittable = false`

### 2.6 端口高亮也应剥离

旧系统依赖 `_highlight_input` / `_highlight_output` 和前景重绘。

迁移后更合理的方式是：

1. 端口本体或其 proxy 维护 hover / candidate 状态
2. `overlayWorld.portHoverHalo` 或端口自身 state style 显示高亮
3. 连线 preview 不再承担“告诉你目标 slot 可连接”的职责

这样连线预览与命中高亮可以解耦，后续也方便接入 `@leafer-in/state`。

---

## 3. 冒泡与阻止策略

### 3.1 冲突源

迁移到 Leafer 后，最主要的冲突不是“怎么监听事件”，而是“谁先吃掉事件”。

核心冲突有 4 组：

1. 端口拉线 vs 节点拖拽
2. 节点拖拽 vs 画布平移
3. 框选 vs 画布平移
4. 节点内部 widget 交互 vs 节点选中/拖拽

### 3.2 统一原则

优先级从高到低：

1. 端口交互
2. 节点内部 widget 交互
3. 节点主体拖拽 / 选中
4. 框选
5. 背景平移 / viewport

也就是说，越接近业务语义的对象，越应该先拿到事件，并在必要时阻止向上冒泡。

### 3.3 推荐阻止规则

| 场景 | 监听对象 | 处理动作 | 阻止策略 |
| --- | --- | --- | --- |
| 点中 port，准备拉线 | `PortProxy` | 进入 `connecting` | `event.stopNow()` + `event.stopDefault()` |
| 点中 widget | `WidgetRoot` | 自己处理 press/drag/input | `event.stopNow()` + `event.stopDefault()` |
| 点中节点主体 | `NodeHitRect` | 选中 / 拖拽节点 | `event.stop()` |
| 背景 + 框选修饰键 | `BackgroundHitRect` | 启动框选 | `event.stop()` |
| 背景平移 | `BackgroundHitRect` 或 viewport plugin | 平移视口 | 只在上面都没消费时执行 |

### 3.4 节点拖拽与画布平移的冲突解决

这是本规范必须明确的地方。

推荐机制：

1. `NodeHitRect` 监听 `pointer.down`
2. 如果命中节点主体并满足拖拽条件：
   - 记录 drag candidate
   - 立即 `event.stop()`
3. 节点 `drag.start / drag / drag.end` 全程继续 `stop()`
4. 背景层或 viewport 插件只能处理未被 stop 的事件

结论：

- 节点拖拽优先于背景平移
- 背景平移只能发生在真正的空白区，或者显式的 viewport 热键模式下

### 3.5 端口拉线与节点拖拽的冲突解决

端口命中优先于节点主体命中。

建议：

1. 每个端口都有独立 `PortProxy`
2. `PortProxy` 的 hit area 应覆盖旧 slot 的实际可点击范围
3. `pointer.down` 命中 `PortProxy` 时直接：
   - 进入 `connecting`
   - `event.stopNow()`

这样可以彻底阻止：

- 节点被误拖动
- 背景被误平移
- widget 抢事件

### 3.6 框选与背景平移的冲突解决

旧系统里：

- `Ctrl + 左键空白区` 是框选
- 普通左键空白区可能进入背景拖拽

迁移后建议保留这个分流：

1. `ctrlKey || metaKey` 时，背景 drag 进入 `box-select`
2. 无修饰键时，背景 drag 进入 `viewport-pan`
3. 框选态一旦成立，立即 `event.stop()`
4. viewport 层看到已 stop 的事件后不再平移

### 3.7 关于 Leafer `stop()` / `stopNow()`

Leafer 事件体系里应使用官方 API，而不是手工操作原生事件：

- `event.stop()`
- `event.stopNow()`
- `event.stopDefault()`

另外文档明确提到：

- 如果需要 PointerEvent 阻止底层原生 MouseEvent 冒泡，要注意 `app.config.pointer.type` 配置

因此迁移期建议：

1. 所有新交互都基于 Leafer 事件
2. 不再在同一条输入链路上同时保留旧 DOM mouse 监听
3. 过渡期若必须共存，要检查 `app.config.pointer.type`

---

## 4. 建议的 Leafer 输入分层

### 4.1 推荐监听对象

```text
tree
├─ backgroundHitRect    // 空白背景命中层
├─ nodeLayer
│  ├─ NodeHitRect*
│  ├─ WidgetRoot*
│  └─ PortProxy*
└─ linkLayer

sky
├─ overlayWorld         // connection preview / selection box
└─ overlayScreen        // menu / tooltip（目标态；当前菜单仍走 DOM 浮层）
```

### 4.2 各层职责

1. `backgroundHitRect`
   - 空白区 pointer / drag
   - 框选起点
   - 背景平移起点

2. `NodeHitRect`
   - 节点单选、多选、拖拽

3. `WidgetRoot`
   - 节点内部按钮、滑杆、数值控件

4. `PortProxy`
   - 端口命中
   - 端口 hover
   - 连线起点和目标点

5. `sky.overlayWorld`
   - 只负责临时视觉态
   - 不负责业务命中

---

## 5. 迁移决策

### 5.1 必须替换的旧状态源

这些旧状态不应继续成为新运行时真相：

- `ds.offset`
- `ds.scale`
- `dragging_canvas`
- `dragging_rectangle`
- `connecting_*`

它们应分别迁移到：

- `app.tree.zoomLayer` 或 `@leafer-in/viewport`
- `InteractionState.selectionBox`
- `InteractionState.connection`
- `sky.overlayWorld` 中的临时 UI 对象

### 5.2 推荐保留的旧语义

应继续保留：

1. `canvasX / canvasY` 的“图坐标”语义
2. `shift / ctrl / meta` 控制多选
3. slot 拉线、重连、断链的行为分支
4. 框选完成后按 bounds 相交选择节点

### 5.3 明确不再保留的实现方式

迁移后不应继续保留：

1. 通过 `rAF + ctx.clearRect()` 反复擦除重画临时交互图形
2. `DragAndScale` 继续充当主 viewport 状态
3. `drawFrontCanvas()` 继续负责临时连线和框选框

这些都必须变成 Leafer 场景树中的状态化对象。

---

## 6. 最终契约

本规范最终要落地成以下契约：

1. 节点拖拽走 `DragEvent`
2. 端口拉线走 `PointerEvent.DOWN/MOVE/UP`
3. 视口平移 / 缩放优先走官方 viewport 能力
4. 旧 `canvasX / canvasY` 语义统一映射为 Leafer `page` 坐标
5. 临时连线和框选框不再在 canvas 前景层中重绘，而是成为 `sky.overlayWorld` 中独立存在的 `UI.Path / UI.Rect`
6. legacy 右键菜单必须收到“原生事件壳 + legacy 坐标字段”的桥接事件，不能直接传 plain object
7. 所有冲突都通过 Leafer 的事件流和 `stop()` / `stopNow()` 解决，而不是再靠全局状态机硬拦

只要按这 7 条落地，交互层就能从“手工事件 + 手工擦除重画”稳定迁移到 Leafer 的保留模式交互架构。
