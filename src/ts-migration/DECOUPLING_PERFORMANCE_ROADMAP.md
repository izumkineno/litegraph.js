# `ts-migration` 解耦与性能重构路线图

本文档只服务于后续重构决策。  
前 7 个结构收敛阶段已经在当前仓库状态落地；本文档现在保留这些阶段的设计意图，同时记录剩余的热点与下一阶段的性能工作。

目标是用最少的结构改动，继续解决 `src/ts-migration` 里剩余的高耦合点和高频路径上的冗余开销。

## 目标

- 先解耦，再做类型收紧。
- 先压缩高频路径复杂度，再处理低频管理代码。
- 先建立稳定模块边界，再考虑更大规模的 API 清洗。

## 当前进度

- 阶段 1 已完成：`contracts/` 已建立，`models/types -> canvas/ui` 的反向依赖已经切断。
- 阶段 2 已完成：`core/host-resolver.ts` 已统一 graph/node/canvas 的 host 注入解析，并带缓存。
- 阶段 3 已完成：`index.ts` 已收回成纯 assembly 层，pointer compat / bridge / compat apply 已拆分。
- 阶段 4 已完成：`LGraphCanvas.menu-panel.ts` 已从千行级 UI 类收敛成薄调度入口，低频 DOM 迁入 `services/`。
- 阶段 5 已完成：菜单、dialog、panel、searchbox 已共享 `floating-ui-service.ts`。
- 阶段 6 已完成：compat 已形成 `compat-schema.ts -> compat-runtime.ts -> facade/.d.ts` 的单一真相。
- 阶段 7 已完成：persistence 已拆成 `serialization-repair + graph-serializer + graph-deserializer + facade`。

## 不做的事

- 不先发起全量“去 `any`”。
- 不先重写整个 `canvas` 继承链。
- 不先替换所有兼容层策略。
- 不以目录更细碎为目标；只有在边界更清晰、运行时更轻时才拆分。

## 优先级原则

### 1. 依赖方向必须单向

- `types` 不能再依赖具体实现类。
- `models` 不应该反向依赖完整 `canvas` 或 `ui` 实现。
- `compat` 不应该把“声明真相”和“运行时代码”继续混在一起。

### 2. 高频路径必须轻

- 每帧路径优先关注 `render`、`input`、执行调度、命中测试。
- 低频 UI 如面板、菜单、搜索框可以复杂，但不能污染高频核心类。
- 避免在热路径里反复做对象合并、动态能力探测、重复坐标换算。

### 3. 兼容逻辑必须集中

- 同一类兼容策略只能有一个运行时实现来源。
- `index.ts` 只能做 assembly，不再内嵌重复 compat 算法。
- 持久化兼容、菜单兼容、静态 API 兼容要各自归位。

### 4. 结构收敛优先于类型美化

- 如果模块边界仍然混乱，类型越“精致”，维护成本越高。
- 类型工作只在边界稳定后推进，否则只是在把历史耦合重新编码。

## 当前结构热点

### P0. `models/types -> canvas/ui` 的反向依赖

直接证据：

- `models/LGraph.lifecycle.ts` 直接引用 `canvas/LGraphCanvas.menu-panel.ts`
- `models/LGraphGroup.ts` 直接引用 `canvas/LGraphCanvas.menu-panel.ts`
- `models/LGraphNode.canvas-collab.ts` 直接引用 `canvas/LGraphCanvas.menu-panel.ts`
- `types/core-types.ts` 直接引用 `canvas`、`models`、`ui` 的具体实现类

问题：

- 最低层类型和核心模型被 UI 实现反向绑定。
- 单元测试、子包裁剪、未来替换 UI 实现都会受阻。
- 现在虽然大量是 `import type`，但模块方向已经不对。

### P0. `index.ts` 不是装配层，而是半个运行时

直接证据：

- `index.ts` 体量过大，承担命名空间装配、compat、全局桥、CJS 桥、默认初始化。
- `index.ts` 内部存在 `createPointerListenerCompat()`。
- 同类指针事件能力已经在 `compat/pointer-events.ts` 单独存在。

问题：

- 同一能力重复实现，未来修复和行为校准会漂移。
- 入口文件承担太多非装配职责，扩展成本越来越高。

### P1. `canvas` 物理拆分了，但职责没有真正拆开

直接证据：

- `canvas/LGraphCanvas.render.ts`
- `canvas/LGraphCanvas.menu-panel.ts`
- `canvas/LGraphCanvas.input.ts`

这几份文件都仍然是千行级，且内部同时承担 orchestration、DOM 构造、命中逻辑、业务菜单、状态切换等多种职责。

问题：

- 热路径与冷路径混在一起。
- 对话框、菜单、搜索框等低频 UI 逻辑继续膨胀主画布类。
- 后续任何 UI 改动都要穿透 `LGraphCanvas` 大类。

### P1. `host` 注入解析模式高度重复

直接证据：

- `LGraph.lifecycle.ts`
- `LGraph.execution.ts`
- `LGraph.io-events.ts`
- `LGraph.structure.ts`
- `LGraph.persistence.ts`
- `LGraphNode.state.ts`
- `LGraphNode.execution.ts`
- `LGraphNode.ports-widgets.ts`

这些文件都在重复：

1. 定义 `defaultHost`
2. 读 `ctor.liteGraph`
3. 合并 host
4. 在方法中反复 `getHost()`

问题：

- 注入来源和优先级散落在每层。
- 默认值很容易渐进式漂移。
- 热路径里反复合并对象，存在不必要的分配成本。

### P1. 浮层 UI 没有公共基础设施

直接证据：

- `ui/ContextMenu.ts` 自己做 DOM、子菜单、定位、边界裁切、关闭传播。
- `canvas/LGraphCanvas.menu-panel.ts` 自己做 `createDialog()`、`createPanel()`、`showSearchBox()`，并重复做 `getBoundingClientRect()`、`style.left/top`。

问题：

- 菜单、对话框、搜索框共享的是“浮层”问题，但现在分散在两处甚至更多处重复实现。
- 关闭策略、定位策略、outside click 策略无法统一。
- 一旦要优化性能或定位行为，需要多处同时改。

### P2. compat 单一真相已建立，但仍需持续约束

直接证据：

- `compat/compat-schema.ts`
- `compat/compat-runtime.ts`
- `types/litegraph-compat.d.ts`
- `types/contract-diff-matrix.md`

当前状态：

- 差异项、host 类型和 apply 逻辑已经按 schema/runtime/facade 拆开。
- 剩余风险不在结构本身，而在后续新增 diff 项时绕过 schema 直接补 façade 或文档。

### P2. `persistence` 已分层，但需要继续守住边界

直接证据：

- `models/LGraph.persistence.ts`
- `models/serialization-repair.ts`
- `models/graph-serializer.ts`
- `models/graph-deserializer.ts`

当前状态：

- 历史数据修补已经移入 `serialization-repair.ts`，纯 IO 已拆到 serializer/deserializer。
- 剩余风险是未来有人把新的 fallback 逻辑重新写回 `LGraph.persistence.ts` 或 graph model。

## 目标架构

### 目标依赖方向

`utils/contracts -> core -> models -> canvas/ui -> compat assembly`

补充约束：

- `types` 与 `contracts` 只描述边界，不 import 具体实现类。
- `models` 只依赖 `contracts` 定义的最小画布接口。
- `canvas` 可以依赖 `models`，但不把自己完整反向暴露给 `models`。
- `index.ts` 只做 assembly，不再自带运行时实现。

### 建议新增的边界层

#### `contracts/`

现状：目录已建立，并只保留最小接口：

- `GraphCanvasPort`
- `ContextMenuPort`
- `DialogPort`
- `NodeExecutionHostPort`
- `GraphPersistencePort`

这些接口必须满足两个要求：

- 只保留真实跨层需要的成员
- 不绑定任何具体类名和具体文件实现

#### `services/`

现状：目录已建立，并承接从大类里抽出的通用逻辑：

- `host-resolver`
- `floating-ui-service`
- `dialog-factory`
- `panel-factory`
- `searchbox-controller`
- `serialization-repair`

## 分阶段路线

## 阶段 1：先修依赖方向

目标：

- 把 `models/types` 对 `canvas/ui` 具体实现类的依赖替换为最小 contracts。

执行顺序：

1. 新增 `contracts/canvas.ts`、`contracts/ui.ts`、`contracts/models.ts`
2. 替换 `types/core-types.ts` 中对具体类的引用
3. 替换 `models/LGraph.lifecycle.ts`、`models/LGraphGroup.ts`、`models/LGraphNode.canvas-collab.ts` 中对 `LGraphCanvas.menu-panel.ts` 的引用
4. 保持行为不变，只替换类型边界

收益：

- 这是解耦的真正起点。
- 后续 `canvas` 再拆时，不会继续把上游拖着走。

风险：

- 需要谨慎识别哪些成员是真正跨层所需，避免 contracts 被做成另一个大接口垃圾桶。

## 阶段 2：统一 host 注入解析

目标：

- 消灭重复的 `defaultHost + getHost()` 模式。

执行顺序：

1. 新增通用 `resolveClassHost()` 或等价 helper
2. 先在 `models/LGraph.*` 链接入
3. 再在 `models/LGraphNode.*` 链接入
4. 最后再看 `canvas` 是否适合复用同一模式

收益：

- 降低重复代码和默认值漂移。
- 为后面做宿主缓存、减少合并分配提供基础。

性能收益：

- 当前很多方法会重复 `getHost()`，每次都触发对象扩展。
- 抽象后可以按实例缓存或按构造器缓存，减少热路径分配。

## 阶段 3：把 `index.ts` 收回成纯装配层

目标：

- 让 `index.ts` 只负责任务编排，不再直接实现 compat 算法。

执行顺序：

1. 把 `createPointerListenerCompat()` 下放或直接删除，统一复用 `compat/pointer-events.ts`
2. 把 assembly 过程拆成几个小函数
3. 把 `global bridge`、`cjs bridge`、`compat apply` 从入口主流程里拆成独立模块
4. 保留一个窄而清晰的 `assembleLiteGraph()`

收益：

- 入口层更稳定。
- compat 行为不再出现“双实现”。

性能收益：

- 不是每帧直接收益，但能减少初始化路径的重复逻辑和后续维护风险。

## 阶段 4：把 `canvas` 按冷热路径重拆

目标：

- 把每帧路径和低频 UI 路径分开。

建议切分原则：

- 热路径：`render`、`input`、命中检测、坐标换算
- 冷路径：菜单、搜索框、对话框、属性面板、子图设置

优先抽离顺序：

1. 从 `LGraphCanvas.menu-panel.ts` 抽 `dialog-factory`
2. 再抽 `panel-factory`
3. 再抽 `searchbox-controller`
4. 再抽 `context-menu-action-builder`

收益：

- `LGraphCanvas` 主类体积下降。
- 低频 UI 不再污染高频类。

性能收益：

- 减少热类中的分支和宿主依赖面。
- 为后续懒加载低频 UI 能力创造条件。

## 阶段 5：统一浮层基础设施

目标：

- 让菜单、对话框、搜索框共享同一套浮层生命周期。

建议抽象：

- 定位
- outside click
- close on leave
- cleanup
- 宿主 document/window 解析

收益：

- `ContextMenu.ts` 和 `LGraphCanvas.menu-panel.ts` 不再各自维护一套浮层系统。
- 交互一致性更高。

性能收益：

- 避免重复安装/卸载监听器策略分裂。
- 减少定位和关闭逻辑的重复计算。

## 阶段 6：compat 单一真相

目标：

- 让 compat schema、runtime、声明文件不再三处手工对齐。

建议拆法：

- `compat-schema.ts`: diff ids、diff items、host contracts
- `compat-runtime.ts`: apply 函数
- `.d.ts`: 只暴露必要声明，不再手写镜像业务说明

收益：

- 差异矩阵可维护性更高。
- 减少文档与运行时代码失步。

## 阶段 7：序列化与修补逻辑分层

目标：

- 从 `LGraph.persistence.ts` 中剥离 repair/migration 逻辑。

建议拆法：

- `graph-serializer`
- `graph-deserializer`
- `serialization-repair`

收益：

- `LGraphPersistence` 重新回到 graph persistence 本职。
- 历史兼容逻辑不会继续污染图模型。

## 性能专项建议

这些事项应贯穿上面的结构调整，而不是最后再做。

### 1. 减少热路径对象分配

重点关注：

- `getHost()` 的对象合并
- 坐标换算临时数组
- 节点命中判断里的临时对象
- 浮层创建时的重复 options merge

原则：

- 热路径优先用缓存或复用对象
- 低频路径才允许更宽松的对象组装

### 2. 区分热类与冷类

建议定义：

- 热类：graph execution、canvas render、canvas input
- 冷类：menu/panel/searchbox/compat bridge

规则：

- 冷类能力不要直接挂进热类主文件
- 热类避免直接 import UI 工厂实现

### 3. 缩小每层依赖面

表现形式：

- 用更窄的 contract 替代完整类类型
- 不让 `models` 看到 `canvas` 的菜单/面板能力
- 不让 `types` 看到具体实现类

### 4. 把一次性装配逻辑留在初始化阶段

原则：

- 全局桥、CJS 桥、compat apply 都应在装配期完成
- 不要把这些判断回流到运行期主循环

## 建议的实施顺序

如果只按“投入产出比”排序，建议顺序如下：

1. 修正依赖方向，建立 `contracts`
2. 统一 host resolver
3. 收缩 `index.ts`
4. 拆 `LGraphCanvas.menu-panel.ts`
5. 抽统一 floating/dialog 服务
6. 收敛 compat 单一真相
7. 分离 persistence repair

## 验收口径

### 结构验收

- `types` 不再 import `canvas/ui/models` 具体实现类
- `models` 不再 import 完整 `LGraphCanvas.menu-panel.ts`
- `index.ts` 不再包含重复的 pointer compat 算法
- `canvas` 冷路径代码从主类里被移出

### 性能验收

- 打开 editor 时初始化分配减少
- 菜单/面板交互不影响绘制路径
- 节点拖拽、框选、连线时不增加额外卡顿
- 高频交互下 listener 数量与临时对象数量更可控

### 维护性验收

- compat 差异只需维护一处 schema
- 新增 UI 浮层时不再复制关闭/定位/cleanup 逻辑
- graph/node/canvas 的宿主注入规则保持统一

## 当前最值得先做的一步

前 7 个阶段已经完成，下一轮最值得投入的不是继续拆文档边界，而是开始兑现高频路径收益：

1. 设计并落地 `rbush` 驱动的节点/分组空间索引
2. 优先覆盖 `getNodeOnPos`、框选命中、可见节点裁剪，再逐步评估 link 命中是否值得纳入索引

原因很直接：

- 结构边界已经足够稳定，继续做“纯解耦”边际收益开始下降。
- 当前最贵的剩余问题在 `input/render` 热路径的线性扫描与命中成本。
- 这一步能把前面 7 个阶段打下的边界优势转成实际的交互性能收益。
