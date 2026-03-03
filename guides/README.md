# LiteGraph

这里汇总了使用 LiteGraph 时的实用信息。

## 附加指南

- [LiteGraph 渲染机制与基础操作时序图](./rendering-and-operations.md)
- [LiteGraph 节点注册、可调用 API 与生命周期指南](./node-registration-and-lifecycle.md)

该库主要分为四个层级：
* **LGraphNode**：节点基类（本库使用自己的继承机制）
* **LGraph**：由多个节点组成的整张图容器
* **LGraphCanvas**：负责浏览器中节点渲染与交互的类

此外，在 `src/` 目录中还包含一个类：
* **LiteGraph.Editor**：对 LGraphCanvas 的封装，提供外围按钮等编辑器 UI。

## LGraphNode

LGraphNode 是所有节点类的基础类。
在注册节点类型时，`LGraphNode.prototype` 中的方法会被复制到你的节点原型上。

因此创建新节点类型时，不需要显式继承这个类；在 `LiteGraph.registerNodeType(...)` 执行时会自动完成方法混入。

下面是一个创建自定义节点的示例：

```javascript
// 你的节点构造函数
function MyAddNode()
{
  // 添加输入槽
  this.addInput("A","number");
  this.addInput("B","number");
  // 添加输出槽
  this.addOutput("A+B","number");
  // 添加属性
  this.properties = { precision: 1 };
}

// 画布中显示的名称
MyAddNode.title = "Sum";

// 节点执行时调用
MyAddNode.prototype.onExecute = function()
{
  // 读取输入数据
  var A = this.getInputData(0);
  if( A === undefined )
    A = 0;
  var B = this.getInputData(1);
  if( B === undefined )
    B = 0;
  // 写入输出数据
  this.setOutputData( 0, A + B );
}

// 注册节点类型
LiteGraph.registerNodeType("basic/sum", MyAddNode );

```

## 节点设置

每个节点可定义或修改如下设置：
* **size**：`[width,height]`，节点内部区域大小（不含标题）。每一行高度为 `LiteGraph.NODE_SLOT_HEIGHT` 像素。
* **properties**：对象，存储用户可配置且会随图一起序列化的属性
* **shape**：节点形状（可选 `LiteGraph.BOX_SHAPE`、`LiteGraph.ROUND_SHAPE`、`LiteGraph.CARD_SHAPE`）
* **flags**：用户可修改且会被序列化保存的标记
* **collapsed**：是否折叠显示（小尺寸）
* **redraw_on_mouse**：鼠标经过 widget 时强制重绘
* **widgets_up**：widgets 不从插槽后开始布局
* **widgets_start_y**：widgets 从指定 Y 坐标开始绘制
* **clip_area**：渲染节点时裁剪内容区域
* **resizable**：是否允许拖拽角点调整大小
* **horizontal**：插槽是否横向布局在节点上/下边

还可定义以下回调：
* **onAdded**：加入图时调用
* **onRemoved**：从图移除时调用
* **onStart**：图开始运行时调用
* **onStop**：图停止运行时调用
* **onDrawBackground**：在画布中渲染自定义背景内容（Live 模式不可见）
* **onDrawForeground**：在画布中渲染自定义前景内容（位于插槽之上）
* **onMouseDown,onMouseMove,onMouseUp,onMouseEnter,onMouseLeave**：鼠标事件
* **onDblClick**：在编辑器中双击节点时触发
* **onExecute**：节点执行时触发
* **onPropertyChanged**：面板中属性变化时触发（返回 `true` 可跳过默认行为）
* **onGetInputs**：返回可选输入数组，格式如 `[ ["name","type"], [...], [...] ]`
* **onGetOutputs**：返回可选输出数组
* **onSerialize**：序列化前触发，参数为可写入数据的对象
* **onSelected**：在编辑器中选中时触发
* **onDeselected**：在编辑器中取消选中时触发
* **onDropItem**：DOM 项被拖放到节点上时触发
* **onDropFile**：文件被拖放到节点上时触发
* **onConnectInput**：若返回 `false`，则取消输入连接
* **onConnectionsChange**：连接发生变化（新增或删除）时触发（`LiteGraph.INPUT` 或 `LiteGraph.OUTPUT`, slot, is_connected, link_info, input_info）

### 节点插槽（Node slots）

每个节点都可以有多个插槽，分别存放在 `node.inputs` 和 `node.outputs` 中。

你可以通过 `node.addInput` 或 `node.addOutput` 添加插槽。

输入和输出的主要区别是：输入最多只能有一条连接，而输出可以连接到多个目标。

要获取某个插槽信息，可访问 `node.inputs[slot_index]` 或 `node.outputs[slot_index]`。

插槽包含以下信息：

 * **name**：插槽名称（也用于画布显示）
 * **type**：该连接中传输的数据类型
 * **link 或 links**：输入槽为单个 link id；输出槽为 link id 数组
 * **label**：可选，用于在画布上显示替代名称
 * **dir**：可选，取值为 `LiteGraph.UP`、`LiteGraph.RIGHT`、`LiteGraph.DOWN`、`LiteGraph.LEFT`
 * **color_on**：连接时的渲染颜色
 * **color_off**：未连接时的渲染颜色

要读取链路上传输的数据，可调用 `node.getInputData` 或 `node.getOutputData`。

### 定义你的图节点

创建图节点类时建议遵循：

- 构造函数里创建默认输入和输出（使用 `addInput` 与 `addOutput`）
- 可编辑属性存放在 `this.properties = {};`
- `onExecute` 是图执行时会调用的方法
- 可通过定义 `onPropertyChanged` 捕获属性变化
- 必须使用 `LiteGraph.registerNodeType("type/name", MyGraphNodeClass);` 注册节点
- 可通过 `MyGraphNodeClass.priority` 修改默认执行优先级（默认 `0`）
- 可通过 `onDrawBackground` 与 `onDrawForeground` 自定义节点渲染

### 自定义节点外观

如果希望标题颜色与主体颜色不同，可配置节点形状或标题颜色：
```js
MyNodeClass.title_color = "#345";
MyNodeClass.shape = LiteGraph.ROUND_SHAPE;
```

你可以使用 `onDrawForeground` 和 `onDrawBackground` 在节点内部绘制内容。区别是：`onDrawForeground` 在 Live 模式也会调用，而 `onDrawBackground` 不会。

这两个函数都会接收 [Canvas2D rendering context](https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D) 以及当前节点所在的 `LGraphCanvas` 实例。

你不需要手动处理坐标系，`(0,0)` 表示节点内容区（不含标题）的左上角。

```js
node.onDrawForeground = function(ctx, graphcanvas)
{
  if(this.flags.collapsed)
    return;
  ctx.save();
  ctx.fillColor = "black";
  ctx.fillRect(0,0,10,this.size[1]);
  ctx.restore();
}
```

### 自定义节点行为

如果你的节点需要特殊交互，也可以捕获鼠标事件。

第二个参数是节点本地坐标，`0,0` 表示节点内容区（标题下方）的左上角。

```js
node.onMouseDown = function( event, pos, graphcanvas )
{
    return true; // 返回 true 表示该事件已被节点消费，阻止其他默认行为
}
```

其他相关方法：
- onMouseMove
- onMouseUp
- onMouseEnter
- onMouseLeave
- onKey

### 节点 Widgets

你可以在节点内添加 widget（文本、数值等编辑控件）。

通常在构造函数里调用 `node.addWidget` 创建。返回值是 widget 对象，建议保存引用，便于后续代码中更新。

基本写法：

```js
function MyNodeType()
{
  this.slider_widget = this.addWidget("slider","Slider", 0.5, function(value, widget, node){ /* 处理值变化 */ }, { min: 0, max: 1} );
}
```

支持的 widget 类型：
* **"number"**：数值输入，语法：`this.addWidget("number","Number", current_value, callback, { min: 0, max: 100, step: 1, precision: 3 } );`
* **"slider"**：拖拽滑条调整数值，语法与 number 相同
* **"combo"**：下拉选择，语法：

  `this.addWidget("combo","Combo", "red", callback, { values:["red","green","blue"]} );`

  或使用对象映射：

  `this.addWidget("combo","Combo", value1, callback, { values: { "title1":value1, "title2":value2 } } );`

* **"text"**：短文本输入
* **"toggle"**：开关（类似复选框）
* **"button"**：按钮

第 4 个可选参数可传 widget 选项，支持：
* **property**：指定 widget 变化时要修改的属性名
* **min**：最小值
* **max**：最大值
* **precision**：小数精度
* **callback**：值变化时触发的函数

默认情况下，保存节点状态时 widget 的值不会被序列化。若希望保存，可设置 `serialize_widgets = true`：

```js
function MyNode()
{
  this.addWidget("text","name","");
  this.serialize_widgets = true;
}
```

如果要把 widget 绑定到节点属性，可在 options 中指定：

```js
function MyNode()
{
  this.properties = { surname: "smith" };
  this.addWidget("text","Surname","", { property: "surname"}); // 会修改 node.properties
}
```

## LGraphCanvas
LGraphCanvas 是负责浏览器中节点渲染与交互的类。

## LGraphCanvas 设置
可定义或修改以下图画布设置以改变行为：

* **allow_interaction**：设为 `false` 时禁用画布交互（可通过节点上的 `flags.allow_interaction` 覆盖画布级设置）

### 画布快捷键
* Space：按住空格并移动鼠标可平移画布。通常配合按住鼠标按键使用，画布很大时更便于连线。
* Ctrl/Shift + Click：将点击节点加入当前选择。
* Ctrl + A：全选节点。
* Ctrl + C/Ctrl + V：复制粘贴选中节点，不保留与未选中节点输出端的连接。
* Ctrl + C/Ctrl + Shift + V：复制粘贴选中节点，并保留未选中节点输出到新粘贴节点输入的连接。
* 按住 Shift 拖拽已选节点：同时移动多个选中节点。

# 执行流程
要执行图，需调用 `graph.runStep()`。

该函数会调用图中每个节点的 `node.onExecute()`。

执行顺序由图结构决定（没有输入的节点是第 0 层，连接到第 0 层节点的是第 1 层，依此类推）。只有图结构变化（新建节点、连接变化）时才会重新计算顺序。

如何在节点内部处理输入/输出由开发者自行决定。

通过 `this.setOutputData(0,data)` 发送到输出的数据会保存在 link 上，因此下游节点调用 `this.getInputData(0)` 时可以读到同样的数据。

在渲染层面，节点按 `graph._nodes` 数组顺序绘制。该顺序会随着用户在 GraphCanvas 的交互变化（被点击节点会被移动到数组末尾，从而最后绘制）。

## 集成

在 HTML 应用中集成：

```js
var graph = new LiteGraph.LGraph();
var graph_canvas = new LiteGraph.LGraphCanvas( canvas, graph );
```

如需启动图：
```js
graph.start();
```

## 事件（Events）

当我们运行 `graph.runStep()` 时，每个节点的 `onExecute` 都会被调用。
但在某些场景下，你只希望在触发器激活时才执行动作，这时可使用事件机制。

事件机制允许节点只在收到某个事件时执行。

定义事件插槽时：输入使用 `LiteGraph.ACTION`，输出使用 `LiteGraph.EVENT`：

```js
function MyNode()
{
  this.addInput("play", LiteGraph.ACTION );
  this.addInput("onFinish", LiteGraph.EVENT );
}
```

当某个输入收到事件后执行代码，需要定义 `onAction`：

```js
MyNode.prototype.onAction = function(action, data)
{
   if(action == "play")
   {
     // 执行动作...
   }

}
```

最后，你还需要在节点内部某个时机触发事件。可在 `onExecute` 中触发，也可在其他交互中触发：

```js
MyNode.prototype.onAction = function(action, data)
{
   if( this.button_was_clicked )
    this.triggerSlot(0); // 触发第 0 个输出槽事件
}
```

库中已经有一些用于处理事件的节点，例如延迟、计数等。

### 自定义连线 Tooltip

当鼠标悬停在连接两个节点的连线上时，会显示一个 tooltip，便于查看从上游输出到下游的数据。

有时节点输出的是对象，而不是易于直接显示的原始值（如字符串）。这种情况下 tooltip 默认会显示 `[Object]`。

如果需要更有描述性的文本，可在输出对象上添加 `toToolTip` 函数，返回你希望显示的内容。

例如，要让输出槽 0 的连线显示 `A useful description`，可输出如下对象：

```javascript
this.setOutputData(0, {
  complexObject: {
    yes: true,
  },
  toToolTip: () => 'A useful description',
});
```
