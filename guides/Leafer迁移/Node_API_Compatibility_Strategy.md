# Node API Compatibility Strategy

本文档定义在引入 LeaferJS 新节点 API 的同时，继续 100% 兼容旧版 Canvas 节点的双轨制运行时策略。

目标非常明确：

1. 旧节点继续按过去的方式工作，不要求高性能，只要求行为正确。
2. 新节点不再直接操作 `CanvasRenderingContext2D`，而是成为 Leafer 保留模式场景树的一部分。
3. 两类节点必须挂载在同一个图运行时中，共享端口、连线、选择、拖拽、缩放、状态系统。

---

## 0. Discovery 结论

### 0.1 已确认的旧节点行为画像

当前仓库中，旧节点并不是“只在个别 demo 中使用 `onDraw*`”，而是大面积依赖 Canvas 即时绘制钩子。

- 统计结果（`src/nodes` + `editor/js/demos.js`）
  - `onDrawBackground`: 30 处
  - `onDrawForeground`: 12 处
  - `onMouseDown`: 12 处
  - `onMouseMove`: 5 处
  - `onMouseUp`: 6 处
  - `onMouseLeave`: 1 处
- `setDirtyCanvas()` / `captureInput()` 这类旧协作 API 仍广泛参与节点刷新与交互控制。

旧节点的典型使用方式已经可以归纳为 4 类：

1. 装饰型即时绘制
   - 直接用 `fillRect`、`stroke`、`fillText`、`measureText` 绘制节点 UI。
   - 代表文件：
     - `src/nodes/interface.js`
     - `src/nodes/midi.js`
     - `src/nodes/audio.js`

2. 预览型位图绘制
   - 直接 `drawImage()` 预览图像、视频帧、canvas 输出、波形等。
   - 代表文件：
     - `src/nodes/graphics.js`
     - `src/nodes/gltextures.js`

3. 交互控件型节点
   - 依赖 `onMouseDown / Move / Up`、`captureInput(true)`、`setDirtyCanvas(true)` 驱动按钮、滑杆、旋钮、键盘等控件。
   - 代表文件：
     - `src/nodes/interface.js`
     - `src/nodes/midi.js`

4. GraphCanvas 协作型节点
   - 依赖 `graphcanvas` 第三个参数、局部坐标计算、甚至调用 `showSubgraphPropertiesDialog()` 之类的宿主能力。
   - 代表文件：
     - `src/nodes/base.js`

### 0.2 已确认的旧运行时真实契约

当前真实契约应以运行时代码为准，而不能只看类型声明。

关键调用点：

- `src/ts-migration/canvas/LGraphCanvas.render.ts`
  - `drawNode()`
  - `drawNodeShape()`
- `src/ts-migration/canvas/LGraphCanvas.input.ts`
  - `processMouseDown()`
  - `processMouseMove()`
  - `processMouseUp()`
- `src/ts-migration/models/LGraphNode.canvas-collab.ts`
  - `setDirtyCanvas()`
  - `captureInput()`

旧节点绘制顺序的关键事实：

1. `drawNodeShape()` 先画节点主形状。
2. 然后调用 `node.onDrawBackground(ctx, this, this.canvas, this.graph_mouse)`。
3. 然后继续画标题条、slot、widget 等默认壳层。
4. `drawNode()` 之后再调用 `node.onDrawForeground(ctx, this, this.canvas)`。

旧节点事件转发的关键事实：

1. `onMouseDown(e, localPos, graphcanvas)`
2. `onMouseMove(e, localPos, graphcanvas)`
3. `onMouseUp(e, localPos, graphcanvas)` 在常规分支存在
4. `node_capturing_input.onMouseUp(e, localPos)` 在捕获分支里历史上少传了第三个参数
5. `onMouseEnter(e)` / `onMouseLeave(e)` 运行时只传了事件对象

旧事件对象的关键字段：

- `canvasX`
- `canvasY`
- `which`
- `button`
- `buttons`
- `click_time`
- `dragging`
- `altKey / ctrlKey / shiftKey / metaKey`

`canvasX / canvasY` 是通过 `adjustMouseEvent()` 根据 `ds.scale + ds.offset` 算出来的图世界坐标。

### 0.3 已查阅的 Leafer 桥接能力

本次已重点查阅以下能力文档：

- `leafer-docs/reference/display/Canvas.md`
- `leafer-docs/reference/display/Image.md`
- `leafer-docs/reference/resource/Resource.md`
- `leafer-docs/reference/display/custom/context.md`
- `leafer-docs/reference/display/App.md`
- `leafer-docs/reference/display/Group.md`
- `leafer-docs/reference/event/ui/Pointer.md`
- `leafer-docs/reference/event/ui/UIEvent.md`
- `leafer-docs/guide/advanced/coordinate.md`
- `leafer-docs/guide/advanced/partRender.md`
- `leafer-docs/plugin/in/viewport/index.md`
- `leafer-docs/plugin/in/state/index.md`

从文档可确认的桥接结论：

1. Leafer 自带 `Canvas` 显示元素，可直接暴露 `context`，通过原生 2D API 绘制后调用 `paint()` 刷新。
2. Leafer `Image` / `Rect.fill.image` 支持 `Blob url`、`Data url`。
3. `Resource.setImage()` 明确支持“原始画布对象”和 `ILeaferCanvas` 作为图片资源输入。
4. Leafer 支持 `custom UI + canvas.context` 方式对接外部 canvas 风格绘制，但需要自己处理 bounds 与 hit path。
5. `PointerEvent` / `UIEvent` 提供 `getInnerPoint()`、`getLocalPoint()`、`getBoxPoint()`，足够做事件降级和局部坐标换算。
6. `App` 的 `ground / tree / sky` 结构非常适合混合承载 legacy bitmap 节点与 modern retained 节点。
7. `@leafer-in/viewport` 适合接管缩放平移视口。
8. `@leafer-in/state` 适合接管 hover / press / selected / disabled 等现代状态样式。

结论：

- Leafer 侧已经具备搭建旧节点兼容沙箱所需的核心原语。
- 兼容层不需要强行把旧节点“翻译”为 Leafer Path/Rect/Text；可以先让它继续画原生 canvas，再挂到 Leafer 场景树中。

---

## 1. 节点运行时鉴别器（The Discriminator）

### 1.1 目标

实例化节点时，以最低成本判断它应走哪条渲染路径：

- `legacy`: 旧 Canvas 节点
- `modern`: 新 Leafer 节点

### 1.2 判别原则

判别应以“安全优先”为原则：

1. 能明确判成 `modern` 才走现代路径。
2. 不能明确判断时，默认回落到 `legacy`。
3. 旧节点兼容性优先于新节点性能。

### 1.3 推荐判别顺序

先看显式声明，再看约定方法，最后才回落默认值。

```ts
type NodeRenderRuntime = 'legacy' | 'modern'

interface NodeConstructorWithRuntime extends Function {
  renderRuntime?: NodeRenderRuntime
}

function detectNodeRuntime(node: any): NodeRenderRuntime {
  const ctor = node.constructor as NodeConstructorWithRuntime

  if (ctor.renderRuntime) return ctor.renderRuntime

  if (
    typeof node.buildUI === 'function' ||
    typeof node.updateUI === 'function' ||
    typeof node.renderLeafer === 'function'
  ) {
    return 'modern'
  }

  if (
    typeof node.onDrawBackground === 'function' ||
    typeof node.onDrawForeground === 'function' ||
    typeof node.onMouseDown === 'function' ||
    typeof node.onMouseMove === 'function' ||
    typeof node.onMouseUp === 'function'
  ) {
    return 'legacy'
  }

  return 'legacy'
}
```

### 1.4 工程约束

1. 允许构造函数显式声明：

```ts
MyNode.renderRuntime = 'modern'
```

2. 新节点最少应暴露 `buildUI()` 或 `renderLeafer()` 中的一种，推荐统一到 `buildUI() + updateUI()`。

3. 若一个节点同时实现了旧钩子与新接口，则必须显式声明 `renderRuntime`，否则视为配置错误。

4. 判别结果应该按“构造函数”缓存到 `WeakMap<Function, NodeRenderRuntime>`，避免每次实例化重复探测。

### 1.5 为什么默认回落到 legacy

因为当前仓库中大量节点只实现旧钩子，且有不少节点依赖运行时的历史 quirks。对这类节点，判错一次就会直接造成功能损坏。默认 legacy 更保守，也更符合“业务连续性优先”的战略要求。

---

## 2. 老节点兼容沙箱（Legacy Node Wrapper）

### 2.1 核心原则

对于 legacy 节点：

- 不追求性能极致
- 不追求渲染模型优雅
- 只追求“旧节点无需改代码即可正常工作”

### 2.2 总体结构

每个 legacy 节点由一个 `LegacyNodeHost` 承载，它是挂在 Leafer 场景树里的适配器对象，而不是业务节点本身。

```text
LegacyNodeHost (Group)
├─ bitmapView      // Leafer Canvas 或 Leafer Image
├─ portOverlay     // 不可见端口命中层
└─ interactionRect // 命中与事件捕获层
```

推荐抽象：

```ts
interface LegacyNodeHost {
  root: Group
  node: LGraphNode
  invalidateVisual(reason?: string): void
  repaintNow(): void
  updateBounds(): void
  getPortAnchor(slotId: number, isInput: boolean): { x: number; y: number }
  destroy(): void
}
```

### 2.3 渲染隔离方案

#### 方案 A：首选方案，Leafer `Canvas` 元素承载旧绘制

推荐优先使用 Leafer 自带的 `Canvas` 元素，而不是一上来就走 url 贴图。

原因：

1. `Canvas` 元素直接提供 `context`。
2. 旧节点需要的就是一个接近原生的 2D 绘图上下文。
3. 绘制完成后调用 `paint()` 即可更新，不需要每次转 `Blob/DataURL`。
4. 它仍然是 Leafer 场景树中的一个标准显示对象。

建议流程：

1. `LegacyNodeHost` 内部维护一张离屏 canvas 或直接维护 Leafer `Canvas` 元素。
2. 每当节点需要刷新时，清空该 bitmap surface。
3. 复用旧 renderer 的节点绘制顺序，把完整节点重新画进去。
4. 调用 `paint()` 将变更提交给 Leafer。

#### 方案 B：兜底方案，离屏 canvas 转资源贴图

当需要更强的资源化能力，或者后续希望与导出流程复用时，可使用：

- `Resource.setImage(key, offscreenCanvas)`
- 再让 Leafer `Image` 或 `Rect.fill.image` 指向该资源

这条路径更像“纹理更新”，但每次刷新都要经历一次资源更新，不应作为 legacy 的首选方案。

### 2.4 兼容绘制不应只调用旧钩子

旧节点不是只依赖 `onDrawBackground()` / `onDrawForeground()` 本身，它还依赖整个旧节点壳层的绘制顺序。

因此兼容沙箱的正确做法不是：

- 只给节点一个空白 ctx，让它自己画

而是：

- 复用旧 runtime 的完整节点绘制逻辑

最稳妥的方式是把旧绘制链提取成“可离屏调用”的纯函数或适配器，例如：

```ts
renderLegacyNodeToContext(node, ctx, legacyRenderContext)
```

内部重用旧的：

- `drawNode()`
- `drawNodeShape()`
- `drawNodeWidgets()`
- slot/title/collapse 绘制逻辑

这样 legacy 节点所有历史绘制语义，包括 `onDrawTitleBar()`、`onDrawCollapsed()`、默认标题条、slot 样式、widget 排布，都能一起保留下来。

### 2.5 脏标记与刷新策略

旧节点的 `setDirtyCanvas(true, true)` 不能再直接解释为“整张 graph canvas 重绘”，而应降级为：

```ts
legacyHost.invalidateVisual('node-request')
```

legacy host 的刷新触发条件建议包括：

1. 节点自己调用 `setDirtyCanvas()`
2. 节点尺寸变化
3. 节点折叠/展开
4. 节点选择态、hover 态、press 态变化
5. 节点属性变化导致预览更新
6. 图主题、缩放阈值、标题显示模式变化

建议策略：

1. 以“节点级”而不是“全场景级”作为最小重绘单位。
2. legacy host 每次重绘直接清空并完整重画整张 node bitmap。
3. 不在 legacy 内做微优化，不尝试保留局部 dirty rect。
4. 让 Leafer 负责场景级局部渲染，legacy host 只负责自己的局部位图刷新。

### 2.6 事件降级透传

Leafer 捕获现代 `PointerEvent` 后，legacy host 需要把它降级成旧节点能识别的事件对象和局部坐标。

建议映射表：

| 旧契约 | Leafer 来源 | 说明 |
| --- | --- | --- |
| `canvasX / canvasY` | `event.x / event.y` 或 `leafer.getWorldPointByClient(origin)` | 保持旧语义里的“图世界坐标” |
| `localPos` | `event.getInnerPoint(nodeRoot)` | 对应旧的 `[canvasX - node.pos[0], canvasY - node.pos[1]]` |
| `clientX / clientY` | `event.origin.clientX / clientY` | 原生事件存在时直接透传 |
| `button / buttons` | `event.buttons` + `left/middle/right` | 转成旧鼠标字段 |
| `which` | 手动换算 | 左 1 / 中 2 / 右 3 |
| `altKey / ctrlKey / shiftKey` | Leafer 事件同名字段 | 直接透传 |
| `metaKey` | `event.origin.metaKey` | Leafer 文档未强调该字段，保底从原生事件取 |
| `click_time` | wrapper 自己记录上次 down/up 时间 | 复现旧逻辑 |
| `dragging` | wrapper 自己维护 | 复现旧逻辑 |
| `preventDefault / stopPropagation` | 转发到 Leafer event / origin | 保持旧节点副作用 |

推荐桥接函数：

```ts
function toLegacyMouseEvent(
  leaferEvent: PointerEvent,
  graphWorld: { x: number; y: number }
): LegacyCanvasMouseEvent
```

### 2.7 captureInput 的兼容方式

旧节点会调用：

```ts
this.captureInput(true)
```

其语义不是浏览器原生 capture，而是：

- 即使光标已离开节点，也继续把 move/up 发给这个节点

因此新的兼容层必须实现一个 graph 级输入捕获表，而不是只依赖单个节点自己的 hover 命中。

建议：

1. `LegacyInputBridge.capturedNodeId`
2. `pointer.down` 时允许节点进入 capture
3. capture 期间，从 `App.tree` 或 `sky` 统一监听 move/up
4. 强制将事件继续分发给被捕获 legacy 节点
5. 节点调用 `captureInput(false)` 或收到 up/cancel 后解除

### 2.8 真实运行时 quirks 必须保留

为了做到 100% 向下兼容，legacy wrapper 应优先模拟当前真实 runtime，而不是“修正”它。

必须显式保留的 quirks：

1. `onMouseEnter(e)` / `onMouseLeave(e)` 只传一个参数
2. 捕获分支下的 `onMouseUp(e, pos)` 少一个 `graphcanvas` 参数
3. `canvasX / canvasY` 语义维持在 graph world，而不是 node local

如果未来要修这些历史不一致，应该通过“compat level” 开关单独推进，而不能在第一版 bridge 中偷偷改掉。

### 2.9 与 Leafer 插件的关系

legacy wrapper 不再维护自己的 `DragAndScale`。

正确方式是：

1. 整个 graph 视口交给 `@leafer-in/viewport`
2. legacy 事件桥只消费已经过视口变换后的坐标
3. legacy 节点继续收到它习惯的 `canvasX / canvasY / localPos`

换句话说，视口逻辑属于宿主，不属于 legacy 节点。

---

## 3. 现代节点 API 规范（Modern Node API）

### 3.1 设计目标

新节点不再“画图”，而是“声明和更新 Leafer UI 树”。

核心原则：

1. 不直接依赖 `CanvasRenderingContext2D`
2. 不再手动 `setDirtyCanvas()`
3. 不再手动维护 `requestAnimationFrame`
4. 以 `Group / Rect / Text / Path / Image / Canvas` 等 Leafer UI 作为渲染原语

### 3.2 推荐接口

推荐把新节点接口统一为“构建 + 更新 + 销毁”的保留模式接口。

```ts
interface ModernNodeViewContext {
  nodeId: string | number
  app: App
  tree: Leafer
  zoomLayer: Group
  contentRoot: Group
  shellRoot: Group
  portRoot: Group
  state: {
    selected: boolean
    hovered: boolean
    pressed: boolean
    disabled: boolean
  }
}

interface ModernNodeRuntime {
  buildUI(ctx: ModernNodeViewContext): Group | UI
  updateUI(root: Group | UI, ctx: ModernNodeViewContext): void
  getPortLayout?(ctx: ModernNodeViewContext): PortLayoutSpec[]
  onPointerEvent?(event: PointerEvent, ctx: ModernNodeViewContext): boolean | void
  disposeUI?(root: Group | UI, ctx: ModernNodeViewContext): void
}
```

### 3.3 壳层归属建议

为了让 legacy 与 modern 能共享一套路由与连线几何，推荐由引擎统一拥有节点壳层：

- 节点外框
- 标题条
- 选中框
- 端口命中区
- 连接高亮

modern 节点主要负责：

- `contentRoot` 内部的声明式内容
- 可选的局部交互
- 可选的自定义端口布局信息

这样做的好处是：

1. 图编辑器的一致性更强
2. 端口与链接几何不被业务节点随意破坏
3. legacy 与 modern 的端口模型天然统一

### 3.4 允许的高级扩展

若现代节点确实需要更底层能力，允许分层降级：

1. 首选 `Rect / Text / Path / Image`
2. 次选 `Canvas` 元素
3. 最后才使用 Leafer `custom UI`

也就是说，现代节点依然可以嵌入局部 imperative 绘制，但该绘制必须被包裹在 Leafer retained 生命周期中，而不是重新发明一套全局 Canvas renderer。

### 3.5 状态样式

现代节点的 hover / press / selected / disabled，优先用 `@leafer-in/state` 表达，而不是复制旧节点的手工状态切换逻辑。

当前仓库尚未安装该插件，因此策略上应明确两点：

1. 现代节点 API 设计应为 `@leafer-in/state` 预留接入点
2. 第一批 modern 节点可以先走显式属性更新，之后再切到 state 插件

### 3.6 不再允许的旧式能力

现代节点不应再暴露以下接口作为主路径：

- `onDrawBackground`
- `onDrawForeground`
- `setDirtyCanvas`
- 直接依赖 `graphcanvas.ctx`
- 直接操作全局视口矩阵

如果必须存在，也只能作为 legacy fallback，不是 modern contract 的一部分。

---

## 4. 混合编排渲染树（Hybrid Scene Graph）

### 4.1 推荐图层结构

在一个 `App` 根容器下，推荐采用以下结构：

```text
App
├─ ground
│  └─ gridLayer
├─ tree.zoomLayer
│  ├─ groupLayer
│  ├─ linkLayerBack
│  ├─ legacyNodeLayer
│  │  └─ LegacyNodeHost*
│  ├─ modernNodeLayer
│  │  └─ ModernNodeHost*
│  └─ linkLayerFront
└─ sky
   ├─ interactionLayer
   ├─ selectionLayer
   └─ debugLayer
```

图层职责建议：

1. `ground.gridLayer`
   - 网格、背景板、低频变化装饰

2. `tree.linkLayerBack`
   - 默认连线
   - 节点背后的弱高亮

3. `tree.legacyNodeLayer`
   - 所有 legacy bitmap 节点

4. `tree.modernNodeLayer`
   - 所有 modern retained 节点

5. `tree.linkLayerFront`
   - 拖拽中的临时连线
   - hover/selected 的增强连线

6. `sky`
   - 选框
   - 手柄
   - 调试 overlay
   - 非缩放的 HUD

### 4.2 为什么 legacy 和 modern 分层

分层不是为了把两套系统永远隔离，而是为了：

1. 更清楚地控制 z-index
2. 更方便批量调试某一种节点
3. 更容易针对 legacy 层单独做兼容处理
4. 降低第一阶段迁移复杂度

后续即便 legacy 节点越来越少，这一层也可以继续保留为兼容层。

### 4.3 端口与连线必须独立于渲染模式

连线不能依赖“节点是 bitmap 还是 retained”来决定几何。

正确做法是让两类节点都实现统一的端口适配接口：

```ts
interface NodePortAdapter {
  getPortAnchor(slotId: number, isInput: boolean): { x: number; y: number }
  getPortHitBounds(slotId: number, isInput: boolean): Bounds
}
```

连线路由器只关心锚点，不关心节点内部是：

- 一张 legacy bitmap
- 还是一个 Leafer `Group`

### 4.4 legacy 节点的端口实现

legacy 节点不应从像素里反推端口位置，而应继续使用当前图模型已有的几何逻辑，例如：

- `getConnectionPos()`
- slot 布局规则

在 Leafer 层面，只需要为这些端口补一层不可见 hit proxy：

- `Rect` / `Ellipse`
- `opacity: 0`
- `hittable: true`

这样 legacy 节点虽然视觉上是一张位图，但交互和连线仍是结构化的。

### 4.5 modern 节点的端口实现

modern 节点允许把端口做成真实 Leafer UI：

- 可见端口图形
- 状态样式
- hover ring
- 拖拽高亮

但其几何输出仍然必须走统一 `NodePortAdapter`，以保证路由器的单一真相。

### 4.6 局部渲染策略

Leafer 的局部渲染机制应继续保留，建议：

1. graph 背景网格层可根据情况关闭 `partRender`
2. legacy node layer 不必关闭 `partRender`，因为每个节点 host 的 bounds 是稳定可知的
3. 连线层继续利用 Leafer 场景级局部重绘

也就是说：

- legacy 内部可以粗暴整张节点重画
- 但场景级仍由 Leafer 帮我们控制脏区域

---

## 5. 推荐实现顺序

### Phase 1: 先立兼容外壳

1. 引入 `detectNodeRuntime()`
2. 为每个节点创建 `LegacyNodeHost` / `ModernNodeHost`
3. 先让所有旧节点都跑进 `LegacyNodeHost`

### Phase 2: 把旧节点完整离屏化

1. 抽取旧的 `drawNode()` 及相关绘制逻辑
2. 让 `LegacyNodeHost` 能在离屏 surface 上复现完整节点
3. 接通 `setDirtyCanvas()` 到 host 级失效系统

### Phase 3: 补齐事件降级

1. 把 Leafer pointer 事件降级为旧事件对象
2. 接通 `captureInput()`
3. 对齐 `click_time`、`dragging`、`which` 等历史字段

### Phase 4: 定义 modern contract 并落第一个新节点

1. 固化 `buildUI() + updateUI() + getPortLayout()`
2. 用一个简单节点验证 retained mode 路径
3. 接入 `@leafer-in/state` 时再补状态样式能力

### Phase 5: 统一连线与端口几何

1. 把 legacy / modern 都接到同一 `NodePortAdapter`
2. 链接层彻底与节点渲染模式解耦

---

## 6. 最高契约

本策略的最高契约如下：

1. 旧节点的第一目标是“零业务改造即可继续运行”
2. 新节点的第一目标是“只生成和更新 Leafer UI，不再写原生 ctx 逻辑”
3. 两类节点共享同一个图模型、端口模型、连线模型、选择模型
4. legacy 的兼容代价由运行时承担，不转嫁给业务节点
5. modern 的性能红利必须来自保留模式，而不是在 Leafer 上再套一层旧 Canvas 心脏

只要这 5 条不被打破，底层就可以在不破坏业务连续性的前提下，逐步从 Canvas 时代过渡到 Leafer 时代。
