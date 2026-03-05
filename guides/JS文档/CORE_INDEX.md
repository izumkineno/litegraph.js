# CORE_INDEX

文件：`src/litegraph.js`  
范围：`L1-L14809`

> 更新说明（2026-03-03）：本页已补齐近期 P1 修复相关索引。历史区段范围可能有小幅漂移，建议优先按函数名检索定位。

## 1. 核心类与原型定义 (Class & Prototype Map)

| 逻辑模块名称 | 职责描述 | 物理坐标 |
|---|---|---|
| LiteGraph 全局命名空间对象 | 统一承载常量、枚举、工厂、注册中心、类型系统与基础工具函数 | `L14-L801` |
| LiteGraph 时间源适配 | 在浏览器/Node 环境下统一时间函数入口 | `L803-L817` |
| LGraph（图运行时容器）构造与静态区 | 图实例创建、状态常量、全局导出绑定 | `L835-L858` |
| LGraph.prototype（生命周期/执行/图结构/序列化） | 图级运行循环、节点管理、I/O 端口、拓扑排序、序列化与加载 | `L853-L2373` |
| LLink（连线模型） | 表示节点间连接关系与链路数据载体 | `L2376-L2417` |
| LGraphNode（节点基类）构造 | 节点实例基础状态初始化 | `L2480-L2525` |
| LGraphNode.prototype（状态与序列化） | 节点配置/序列化/克隆/属性管理 | `L2531-L2794` |
| LGraphNode.prototype（数据与执行协议） | 输入输出读写、执行触发、动作分发、事件槽触发 | `L2795-L3429` |
| LGraphNode.prototype（端口与部件系统） | 输入输出端口管理、Widget 管理、节点尺寸计算 | `L3430-L3879` |
| LGraphNode.prototype（几何与连接管理） | 命中测试、槽位查找、连线建立/断开、连接点计算 | `L3880-L4841` |
| LGraphNode.prototype（画布协作） | 对齐、追踪、资源加载、交互捕获、折叠/固定 | `L4842-L4989` |
| LGraphGroup（分组模型） | 分组边界、分组序列化、组内节点归集 | `L4990-L5089` |
| DragAndScale（视图变换控制器） | 画布平移缩放、可视区域计算、底层鼠标/指针桥接 | `L5093-L5309` |
| LGraphCanvas（画布控制器）构造与静态区 | 画布级状态、渲染参数、图绑定、默认静态资源 | `L5325-L5457` |
| LGraphCanvas.prototype（运行与事件绑定） | 画布生命周期、事件绑定/解绑、渲染循环起停 | `L5463-L5919` |
| LGraphCanvas.prototype（输入交互） | 鼠标/键盘/拖放/选择/剪贴板/缩放/坐标变换 | `L5920-L7788` |
| LGraphCanvas.prototype（渲染管线） | 前后景绘制、节点/连线/组渲染、Widget 绘制与交互处理 | `L7789-L10338` |
| LGraphCanvas.prototype（面板与菜单系统） | 搜索框、属性编辑、对话框、面板与上下文菜单调度 | `L10339-L13516` |
| 几何与颜色工具函数组 | 通用比较、距离、包围盒、颜色转换等基础工具 | `L13519-L13646` |
| ContextMenu（上下文菜单组件） | 菜单构建、子菜单层级、事件派发、关闭机制 | `L13662-L14115` |
| CurveEditor（曲线编辑器） | 节点内曲线型 Widget 绘制与点编辑交互 | `L14117-L14293` |
| 运行时辅助与导出桥 | 参数名解析、指针事件兼容层、`requestAnimationFrame` 兜底、CommonJS 导出 | `L14563-L14808` |

## 2. 静态常量与注册中心 (Constants & Registry)

### 2.1 全局配置块

| 配置块 | 内容性质 | 物理坐标 |
|---|---|---|
| LiteGraph 常量/枚举/默认配置主块 | 节点尺寸、渲染模式、方向枚举、连接模式、全局开关、注册表容器 | `L15-L149` |
| LiteGraph 时间函数适配块 | `performance` / `Date` / `process.hrtime` 兼容选择 | `L803-L817` |
| LGraph 静态状态码与支持类型 | 图运行状态常量、默认支持类型 | `L849-L858` |
| LGraphCanvas 静态默认资源与颜色映射 | 默认背景、链路类型颜色、渐变缓存 | `L5449-L5457` |
| CommonJS 导出清单 | 模块级对象导出契约 | `L14798-L14808` |

### 2.2 注册机制

| 注册机制 | 作用 | 物理坐标 |
|---|---|---|
| `registerNodeType` | 注册节点类型并注入 `LGraphNode` 原型能力 | `L196-L313` |
| `unregisterNodeType` | 反注册节点类型 | `L314-L333` |
| `registerNodeAndSlotType` | 维护槽位类型到节点类型映射 | `L334-L387` |
| `buildNodeClassFromObject` | 对象描述转节点类并注册 | `L390-L441` |
| `wrapFunctionAsNode` | 函数签名封装为节点类并注册 | `L442-L497` |
| `addNodeMethod` | 运行时向全部节点类型批量注入方法 | `L511-L529` |
| `createNode` | 基于已注册类型进行节点工厂创建 | `L530-L603` |
| `registerSearchboxExtra` | 注册搜索框扩展入口 | `L784-L800` |
| `extendClass` | 原型层级扩展/混入辅助 | `L14341-L14383` |

## 3. 核心流转路径 (Critical Execution Flows)

### 3.1 初始化与挂载

| 流程节点 | 物理坐标 |
|---|---|
| 全局对象初始化（IIFE + LiteGraph 构建） | `L2-L801` |
| 图实例初始化（构造 + `clear`） | `L835-L845`, `L865-L934` |
| 画布实例初始化（构造 + 图绑定 + canvas 绑定） | `L5325-L5445`, `L5510-L5538`, `L5615-L5685` |
| 交互系统挂载（`bindEvents`） | `L5758-L5822` |
| 节点实例创建并挂入图（`createNode` + `add`） | `L530-L603`, `L1523-L1601` |
| 子图挂载与切换（open/close subgraph） | `L5552-L5604` |

### 3.2 渲染与更新循环

| 流程节点 | 物理坐标 |
|---|---|
| 图执行循环启动（`start` + `on_frame`） | `L975-L1018` |
| 单步执行（`runStep`） | `L1054-L1149` |
| 执行顺序刷新（`updateExecutionOrder` / `computeExecutionOrder`） | `L1150-L1306` |
| 画布渲染循环启动（`startRendering` + `renderFrame`） | `L6037-L6056` |
| 画布主绘制入口（`draw`） | `L7814-L7850` |
| 前景/背景拆分绘制 | `L7851-L8117`, `L8351-L8538` |
| 节点与连接渲染主链路 | `L8539-L9767` |
| Widget 绘制与处理 | `L9863-L10294` |

### 3.3 序列化机制

| 流程节点 | 物理坐标 |
|---|---|
| 图序列化（节点/连线/分组打包） | `L2185-L2232` |
| 图反序列化配置（节点重建与回填） | `L2240-L2333` |
| 图加载（File/HTTP） | `L2334-L2370` |
| 连线序列化与反序列化 | `L2388-L2415` |
| 节点序列化与反序列化 | `L2531-L2698` |
| 分组序列化与反序列化 | `L5037-L5057` |
| 剪贴板复制/粘贴（图局部序列化路径） | `L7232-L7369` |

### 3.4 交互与事件流

| 流程节点 | 物理坐标 |
|---|---|
| 视图级输入桥接（DragAndScale） | `L5114-L5226` |
| 画布低层输入处理（Down/Move/Up/Wheel/Key） | `L5926-L7231` |
| 拖放入口（`processDrop` / `checkDropItem`） | `L7370-L7464` |
| 选择与多选流 | `L7481-L7619` |
| 节点动作/事件传播（`doExecute`/`actionDo`/`triggerSlot`） | `L3222-L3393` |
| 图级广播（`sendEventToAllNodes`） | `L1416-L1449` |
| 菜单交互分发（`processContextMenu` + ContextMenu） | `L13358-L13516`, `L13662-L14115` |

## 4. 数据模型与契约 (Data Schema & Contracts)

### 4.1 内部存储结构

| 核心类 | 内部组织方式 | 物理坐标 |
|---|---|---|
| `LGraph` | 节点数组、节点索引映射、执行序列表、分组集合、连线映射、全局配置与扩展数据 | `L865-L934`, `L2185-L2226` |
| `LLink` | 连线元组（起点/终点/类型）+ 运行期链路数据缓存 | `L2376-L2415` |
| `LGraphNode` | 端口数组（`inputs`/`outputs`）、属性字典、Widget 列表、标志位、几何状态 | `L2486-L2525`, `L3430-L3879` |
| `LGraphGroup` | 包围盒、内部节点缓存、分组样式状态 | `L4996-L5072` |
| `LGraphCanvas` | 画布上下文、可视区域、选择集、拖拽状态、渲染缓存、交互回调引用 | `L5325-L5445`, `L5463-L5764` |

### 4.2 输入输出协议

| 协议面 | 关键契约 | 物理坐标 |
|---|---|---|
| 槽位类型兼容协议 | 连接合法性判定（含通配与多类型） | `L684-L729` |
| 图级 I/O 端口协议 | 图输入输出端口的增删改查与触发入口 | `L1817-L2074` |
| 节点数据通道协议 | 输入读取、输出写入、类型声明与查询 | `L2795-L3113` |
| 节点事件协议 | 触发/动作/事件槽分发与延迟动作执行 | `L3172-L3393` |
| 连线协议 | 连接建立、断开、连接点计算 | `L4185-L4841` |
| 序列化数据契约（Graph） | `nodes[]`、`links[]`、`groups[]` 及元信息打包 | `L2185-L2232` |
| 序列化数据契约（Node） | 节点最小状态、端口、属性、Widget 值打包 | `L2625-L2698` |
| 序列化数据契约（Link） | 紧凑数组式连线协议 | `L2406-L2415` |

## 5. 架构耦合点 (Architectural Coupling)

### 5.1 硬编码依赖

| 依赖对象 | 耦合位置 | 物理坐标 |
|---|---|---|
| `global` / `window` | 全局对象注入、运行时能力探测、`requestAnimationFrame` 使用 | `L2-L14`, `L975-L1005`, `L14404-L14411` |
| `document` / DOM API | 脚本重载、Canvas 选择、事件绑定、菜单与对话框 DOM 构建 | `L664-L708`, `L5383-L5392`, `L5758-L5822`, `L12431-L12570`, `L13972-L14118` |
| `fetch` / `FileReader` / `XMLHttpRequest` | 文件加载与图配置入口 | `L747-L799`, `L2334-L2370` |
| `process.hrtime` | Node 侧时间源适配 | `L808-L812` |
| CommonJS `exports` | 模块导出适配层 | `L14414-L14423` |

### 5.2 扩展模式

| 扩展模式 | 机制描述 | 物理坐标 |
|---|---|---|
| 注册中心模式 | 节点类型/槽位类型注册与检索 | `L196-L389`, `L604-L653` |
| 工厂模式 | 统一节点实例化入口 | `L530-L603` |
| 动态类生成模式 | 函数/对象即时封装为节点类并注册 | `L390-L497` |
| 原型注入模式 | 运行时向节点类型注入新方法 | `L511-L529` |
| 类扩展混入模式 | 目标类/原型从来源类复制能力 | `L14341-L14383` |
| 回调钩子扩展面 | 图、节点、画布多层事件回调注入点 | `L1416-L1449`, `L2531-L2618`, `L5325-L5419`, `L10339-L13516` |
| 搜索扩展面 | 搜索框附加条目注册 | `L784-L800` |

## 6. 细粒度方法索引 (Method-Level Atlas)

### 6.1 LiteGraph 命名空间 API 索引

| API 组 | 方法 | 物理坐标 |
|---|---|---|
| 类型注册与工厂 | `registerNodeType` | `L196-L313` |
| 类型注册与工厂 | `unregisterNodeType` | `L314-L333` |
| 类型注册与工厂 | `registerNodeAndSlotType` | `L334-L387` |
| 类型注册与工厂 | `buildNodeClassFromObject` | `L390-L441` |
| 类型注册与工厂 | `wrapFunctionAsNode` | `L442-L497` |
| 类型注册与工厂 | `clearRegisteredTypes` | `L498-L510` |
| 类型注册与工厂 | `addNodeMethod` | `L511-L529` |
| 类型注册与工厂 | `createNode` | `L530-L603` |
| 类型查询与分类 | `getNodeType` | `L604-L614` |
| 类型查询与分类 | `getNodeTypesInCategory` | `L615-L644` |
| 类型查询与分类 | `getNodeTypesCategories` | `L645-L663` |
| 运行时维护 | `reloadNodes` | `L664-L708` |
| 运行时维护 | `cloneObject` | `L709-L726` |
| 运行时维护 | `uuidv4` | `L727-L737` |
| 协议判定 | `isValidConnection` | `L738-L783` |
| 搜索扩展 | `registerSearchboxExtra` | `L784-L800` |
| 外部资源装载 | `fetchFile` | `L801-L854` |
| 工具函数 | `getParameterNames` | `L14563-L14573` |
| 交互兼容层 | `pointerListenerAdd` | `L14694-L14754` |
| 交互兼容层 | `pointerListenerRemove` | `L14755-L14779` |

### 6.2 LGraph.prototype 全量索引

| 子系统 | 方法 | 物理坐标 |
|---|---|---|
| 生命周期 | `getSupportedTypes` | `L853-L864` |
| 生命周期 | `clear` | `L865-L934` |
| 生命周期 | `attachCanvas` | `L935-L955` |
| 生命周期 | `detachCanvas` | `L956-L974` |
| 生命周期 | `start` | `L975-L1024` |
| 生命周期 | `stop` | `L1025-L1053` |
| 执行调度 | `runStep` | `L1054-L1149` |
| 执行调度 | `updateExecutionOrder` | `L1150-L1160` |
| 执行调度 | `computeExecutionOrder` | `L1161-L1306` |
| 图查询与布局 | `getAncestors` | `L1307-L1339` |
| 图查询与布局 | `arrange` | `L1340-L1384` |
| 时间系统 | `getTime` / `getFixedTime` / `getElapsedTime` | `L1385-L1415` |
| 事件广播 | `sendEventToAllNodes` | `L1416-L1449` |
| 事件广播 | `sendActionToCanvas` | `L1450-L1468` |
| 节点集合管理 | `add` | `L1469-L1547` |
| 节点集合管理 | `remove` | `L1548-L1640` |
| 节点检索 | `getNodeById` | `L1641-L1653` |
| 节点检索 | `findNodesByClass` | `L1654-L1670` |
| 节点检索 | `findNodesByType` | `L1671-L1688` |
| 节点检索 | `findNodeByTitle` / `findNodesByTitle` | `L1689-L1721` |
| 命中检测 | `getNodeOnPos` | `L1776-L1799` |
| 命中检测 | `getGroupOnPos` | `L1804-L1818` |
| 类型一致性 | `checkNodeTypes` | `L1819-L1845` |
| 图动作入口 | `onAction` / `trigger` | `L1846-L1885` |
| 子图 I/O | `addInput` / `setInputData` / `getInputData` | `L1817-L1871` |
| 子图 I/O | `renameInput` / `changeInputType` / `removeInput` | `L1872-L1955` |
| 子图 I/O | `addOutput` / `setOutputData` / `getOutputData` | `L1956-L2002` |
| 子图 I/O | `renameOutput` / `changeOutputType` / `removeOutput` | `L2003-L2073` |
| 子图 I/O | `triggerInput` / `setCallback` | `L2074-L2088` |
| 变更事务 | `beforeChange` / `afterChange` / `connectionChange` | `L2089-L2117` |
| 运行状态 | `isLive` / `clearTriggeredSlots` | `L2118-L2148` |
| 刷新与脏标 | `change` / `setDirtyCanvas` | `L2149-L2167` |
| 连线管理 | `removeLink` | `L2168-L2184` |
| 持久化 | `serialize` | `L2185-L2239` |
| 持久化 | `configure` | `L2240-L2333` |
| 持久化 | `load` | `L2334-L2370` |
| 诊断钩子 | `onNodeTrace` | `L2371-L2373` |

### 6.3 LGraphNode.prototype 全量索引

| 子系统 | 方法 | 物理坐标 |
|---|---|---|
| 构造与状态 | `_ctor` | `L2486-L2530` |
| 构造与状态 | `configure` / `serialize` / `clone` | `L2531-L2741` |
| 元信息 | `toString` / `getTitle` / `setProperty` | `L2742-L2794` |
| 数据通道 | `setOutputData` / `setOutputDataType` | `L2795-L2862` |
| 数据通道 | `getInputData` / `getInputDataType` / `getInputDataByName` | `L2863-L2952` |
| 连接状态查询 | `isInputConnected` / `getInputInfo` / `getInputLink` / `getInputNode` / `getInputOrProperty` | `L2953-L3045` |
| 连接状态查询 | `getOutputData` / `getOutputInfo` / `isOutputConnected` / `isAnyOutputConnected` / `getOutputNodes` | `L3046-L3141` |
| 执行模式 | `addOnTriggerInput` / `addOnExecutedOutput` / `onAfterExecuteNode` / `changeMode` | `L3142-L3203` |
| 执行模式 | `executePendingActions` / `doExecute` / `actionDo` | `L3204-L3282` |
| 事件系统 | `trigger` / `triggerSlot` / `clearTriggeredSlot` | `L3283-L3429` |
| 端口/属性 | `setSize` / `addProperty` / `addOutput` / `addOutputs` / `removeOutput` | `L3430-L3566` |
| 端口/属性 | `addInput` / `addInputs` / `removeInput` / `addConnection` | `L3567-L3673` |
| 几何与 Widget | `computeSize` / `getPropertyInfo` / `addWidget` / `addCustomWidget` | `L3674-L3879` |
| 几何命中 | `getBounding` / `isPointInside` / `getSlotInPosition` | `L3880-L4015` |
| 槽位检索 | `findInputSlot` / `findOutputSlot` / `findInputSlotFree` / `findOutputSlotFree` | `L4016-L4106` |
| 槽位检索 | `findInputSlotByType` / `findOutputSlotByType` / `findSlotByType` | `L4107-L4184` |
| 连线建立 | `connectByType` / `connectByTypeOutput` / `connect` | `L4185-L4502` |
| 连线拆除 | `disconnectOutput` / `disconnectInput` | `L4503-L4753` |
| 连线几何 | `getConnectionPos` | `L4754-L4841` |
| 画布协作 | `alignToGrid` / `trace` / `setDirtyCanvas` / `loadImage` | `L4842-L4894` |
| 交互协作 | `executeAction` / `captureInput` / `collapse` / `pin` / `localToScreen` | `L4895-L4989` |

### 6.4 LGraphCanvas.prototype 全量索引

| 子系统 | 方法 | 物理坐标 |
|---|---|---|
| 生命周期与绑定 | `clear` / `setGraph` / `getTopGraph` / `openSubgraph` / `closeSubgraph` / `getCurrentGraph` / `setCanvas` | `L5463-L5685` |
| 生命周期与绑定 | `_doNothing` / `_doReturnTrue` / `bindEvents` / `unbindEvents` | `L5686-L5823` |
| 生命周期与绑定 | `enableWebGL` / `setDirty` / `getCanvasWindow` / `startRendering` / `stopRendering` / `blockClick` | `L5824-L5925` |
| 输入处理 | `processMouseDown` / `processMouseMove` / `processMouseUp` / `processMouseWheel` / `processKey` | `L5926-L7231` |
| 输入处理 | `copyToClipboard` / `pasteFromClipboard` / `processDrop` / `checkDropItem` | `L7232-L7464` |
| 选择系统 | `processNodeDblClicked` / `processNodeSelected` / `selectNode` / `selectNodes` / `deselectNode` / `deselectAllNodes` / `deleteSelectedNodes` | `L7465-L7655` |
| 视图控制 | `centerOnNode` / `adjustMouseEvent` / `setZoom` / `convertOffsetToCanvas` / `convertCanvasToOffset` / `convertEventToCanvasOffset` | `L7656-L7755` |
| 层级与可见性 | `bringToFront` / `sendToBack` / `computeVisibleNodes` | `L7756-L7813` |
| 绘制主链路 | `draw` / `drawFrontCanvas` / `drawBackCanvas` | `L7814-L8538` |
| 绘制主链路 | `drawNode` / `drawLinkTooltip` / `drawNodeShape` / `drawConnections` / `renderLink` / `computeConnectionPoint` / `drawExecutionOrder` | `L8539-L9862` |
| Widget 绘制与输入 | `drawNodeWidgets` / `processNodeWidgets` | `L9863-L10294` |
| 分组与尺寸 | `drawGroups` / `adjustNodesSize` / `resize` | `L10295-L10373` |
| 运行视图状态 | `switchLiveMode` / `onNodeSelectionChange` / `boundaryNodesForSelection` | `L10374-L10977` |
| 连线/搜索/创建 | `showLinkMenu` / `createDefaultNodeForSlot` / `showConnectionMenu` / `prompt` / `showSearchBox` | `L11151-L12430` |
| 面板系统 | `showEditPropertyValue` / `createDialog` / `createPanel` / `closePanels` | `L12297-L12795` |
| 面板系统 | `showShowGraphOptionsPanel` / `showShowNodePanel` / `showSubgraphPropertiesDialog` / `showSubgraphPropertiesDialogRight` / `checkPanels` | `L12539-L13173` |
| 菜单系统 | `getCanvasMenuOptions` / `getNodeMenuOptions` / `getGroupMenuOptions` / `processContextMenu` | `L13439-L13623` |

### 6.5 其他类与工具全量索引

| 模块 | 方法 | 物理坐标 |
|---|---|---|
| LLink | `configure` / `serialize` | `L2388-L2415` |
| LGraphGroup | `_ctor` / `configure` / `serialize` / `move` / `recomputeInsideNodes` | `L4996-L5085` |
| LGraphGroup | 复用 `LGraphNode` 能力：`isPointInside` / `setDirtyCanvas` | `L5087-L5088` |
| DragAndScale | `bindEvents` / `computeVisibleArea` / `onMouse` | `L5114-L5226` |
| DragAndScale | `toCanvasContext` / `convertOffsetToCanvas` / `convertCanvasToOffset` / `mouseDrag` / `changeScale` / `changeDeltaScale` / `reset` | `L5228-L5309` |
| ContextMenu | `addItem` / `close` / `getTopMenu` / `getFirstEvent` | `L13848-L14029` |
| ContextMenu | 静态：`trigger` / `isCursorOverElement` | `L14003-L14047` |
| CurveEditor | `sampleCurve` / `draw` / `onMouseDown` / `onMouseMove` / `onMouseUp` / `getCloserPoint` | `L14127-L14290` |
| 通用几何与颜色工具 | `compareObjects` / `distance` / `colorToString` / `isInsideRectangle` / `growBounding` / `isInsideBounding` / `overlapBounding` / `hex2num` / `num2hex` | `L13519-L13646` |

## 7. 关键流转分解 (Step-by-Step Call Paths)

### 7.1 图执行主路径（运行时）

| 步骤 | 调用点 | 物理坐标 |
|---|---|---|
| 1 | 图进入运行态并触发启动钩子 | `L975-L986` |
| 2 | 建立逐帧/定时执行入口（`on_frame` 或 `setInterval`） | `L993-L1017` |
| 3 | 单步执行入口 `runStep` | `L1054-L1149` |
| 4 | 执行顺序来源于 `_nodes_executable`（由拓扑计算生成） | `L1150-L1306` |
| 5 | 节点执行期通过 `LGraphNode.doExecute` / `actionDo` / `triggerSlot` 传播 | `L3222-L3393` |

### 7.2 画布渲染主路径（可视层）

| 步骤 | 调用点 | 物理坐标 |
|---|---|---|
| 1 | 启动渲染循环 `startRendering` | `L6037-L6056` |
| 2 | 每帧进入 `draw` | `L7814-L7850` |
| 3 | 分离前景/背景渲染 `drawFrontCanvas` + `drawBackCanvas` | `L7851-L8117`, `L8351-L8538` |
| 4 | 节点、连线与执行序绘制 | `L8539-L9862` |
| 5 | Widget 渲染与交互处理 | `L9863-L10294` |

### 7.3 连接创建路径（交互到模型）

| 步骤 | 调用点 | 物理坐标 |
|---|---|---|
| 1 | 指针按下进入 `processMouseDown`，判定命中槽位 | `L5926-L6422` |
| 2 | 指针移动由 `processMouseMove` 持续更新连线态 | `L6423-L6679` |
| 3 | 指针抬起由 `processMouseUp` 提交连接 | `L6680-L6991` |
| 4 | 最终建立连接调用 `LGraphNode.connect*` | `L4185-L4502` |
| 5 | 图侧变更通知与画布脏标更新 | `L2104-L2167` |

### 7.4 反序列化装配路径（导入）

| 步骤 | 调用点 | 物理坐标 |
|---|---|---|
| 1 | 入口 `configure(data)` | `L2240-L2248` |
| 2 | 连线数据结构解包为 `LLink` 映射 | `L2252-L2266` |
| 3 | 首轮创建节点实例并入图 | `L2277-L2300` |
| 4 | 次轮按 ID 回填节点配置 | `L2302-L2309` |
| 5 | 重建分组并刷新执行顺序 | `L2312-L2323` |
| 6 | 触发配置钩子并刷新画布 | `L2326-L2331` |

## 8. 字段级契约补充 (Field-Level Contracts)

### 8.1 LGraph 运行态字段簇

| 字段簇 | 字段 | 初始化坐标 |
|---|---|---|
| 身份与版本 | `status`, `last_node_id`, `last_link_id`, `_version` | `L867-L873` |
| 节点存储 | `_nodes`, `_nodes_by_id`, `_nodes_in_order`, `_nodes_executable` | `L885-L889` |
| 结构存储 | `_groups`, `links` | `L891-L895` |
| 执行时钟 | `iteration`, `globaltime`, `runningtime`, `fixedtime`, `fixedtime_lapse`, `elapsed_time`, `last_update_time`, `starttime` | `L897-L912` |
| 运行标记 | `catch_errors`, `nodes_executing`, `nodes_actioning`, `nodes_executedAction` | `L913-L918` |
| 子图接口 | `inputs`, `outputs` | `L920-L921` |
| 扩展数据 | `config`, `vars`, `extra` | `L900-L903` |

### 8.2 LGraphNode 运行态字段簇

| 字段簇 | 字段 | 初始化坐标 |
|---|---|---|
| 标识信息 | `id`, `type`, `title` | `L2487-L2514` |
| 几何状态 | `size`, `_pos`, `pos` 访问器 | `L2488-L2505` |
| 容器引用 | `graph` | `L2489` |
| 端口容器 | `inputs`, `outputs`, `connections` | `L2515-L2518` |
| 属性容器 | `properties`, `properties_info`, `flags` | `L2520-L2524` |

### 8.3 LGraphCanvas 运行态字段簇

| 字段簇 | 字段 | 初始化坐标 |
|---|---|---|
| 视图变换 | `ds`, `visible_area`, `viewport` | `L5336`, `L5427`, `L5430` |
| 渲染配置 | `highquality_render`, `clear_background`, `render_*`, `links_render_mode` | `L5361-L5399` |
| 交互开关 | `read_only`, `allow_*`, `multi_select`, `filter` | `L5368-L5384` |
| 鼠标状态 | `mouse`, `graph_mouse`, `canvas_mouse`, `last_mouse_position` | `L5400-L5403`, `L5426` |
| 回调接口 | `onMouse`, `onDraw*`, `onNodeMoved`, `onSelectionChange`, `onBeforeChange`, `onAfterChange` | `L5408-L5419` |
| 选择与可视 | `current_node`, `node_widget`, `over_link_center`, `visible_links` | `L5423-L5429` |

### 8.4 序列化对象契约（字段层）

| 对象 | 字段定义来源 | 物理坐标 |
|---|---|---|
| Graph 序列化对象 | `last_node_id`, `last_link_id`, `nodes`, `links`, `groups`, `config`, `extra`, `version` | `L2217-L2226` |
| Node 序列化对象 | `id`, `type`, `pos`, `size`, `flags`, `order`, `mode`, `inputs`, `outputs`, `title`, `properties`, `widgets_values`, `color/bgcolor/boxcolor/shape` | `L2627-L2687` |
| Link 序列化对象 | `[id, origin_id, origin_slot, target_id, target_slot, type]` | `L2406-L2415` |
| Group 序列化对象 | `title`, `bounding`, `color`, `font_size` | `L5044-L5056` |

## 9. 近期修复索引（P1 TODO，2026-03-03）

| 能力域 | 关键入口 | 当前坐标 |
|---|---|---|
| 断线修饰键策略 | `click_do_break_link_from_key` / `isBreakLinkModifierPressed` / `processMouseDown` 输出槽断线分支 | `L115`, `L116-L132`, `L6231` |
| 触摸设备识别 | `isTouchDevice` | `L170-L179` |
| 节点注册自动收集槽位类型 | `registerNodeType` / `registerNodeAndSlotType` | `L196-L313`, `L334-L387` |
| 重叠节点命中优先级 | `LGraph.getNodeOnPos` | `L1776-L1799` |
| Pointer/Touch 事件闭环 | `bindEvents` / `unbindEvents` / `processPointerCancel` / `processTouch` | `L5758-L5822`, `L5823-L5878`, `L5879-L5894`, `L5895-L6036` |
| 渲染颜色兜底 | `drawNode`（标题渐变/非法颜色防护） | `L8699-L9532` |
| 搜索框关闭策略与类型过滤 guard | `showSearchBox` | `L11681-L12296` |
| Dialog 统一关闭策略 | `createDialog` | `L12431-L12570` |
| 节点菜单子图入口 | `getNodeMenuOptions`（`To Subgraph`） | `L13486-L13601` |
| ContextMenu 桌面/触摸分流关闭 | `ContextMenu` 构造中的 `close_on_leave` 逻辑 | `L14042-L14055` |
| 指针兼容层（防重复绑定） | `pointerListenerAdd` / `pointerListenerRemove` | `L14694-L14754`, `L14755-L14779` |
