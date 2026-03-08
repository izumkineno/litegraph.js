# Leafer 布局与 UI 设计文档索引

本文从 `leafer-docs/` 中筛出与“布局系统、UI 结构、视觉样式、交互状态、设计器样式”直接相关的文档，作为 Leafer 迁移阶段的专题索引。

目标不是罗列全部 Leafer 文档，而是为当前仓库的 Modern Node Shell、节点布局、状态样式、视口和设计器交互提供一套高信号入口。

---

## 1. 必读顺序

如果是第一次系统性阅读 Leafer 的布局与 UI 文档，建议按下面顺序进入：

1. [创建 App 应用](../../leafer-docs/guide/advanced/app.md)
   适合先建立 `App / ground / tree / sky` 分层思维。
2. [App](../../leafer-docs/reference/display/App.md)
   对应运行时容器能力与多层引擎结构。
3. [Leafer-tree](../../leafer-docs/guide/design/tree.md)
   适合理解 UI 树、布局、渲染、事件的基础模型。
4. [转换坐标](../../leafer-docs/guide/advanced/coordinate.md)
   解决 viewport、命中测试、局部坐标和世界坐标问题的核心文档。
5. [layout](../../leafer-docs/reference/UI/layout.md)
   集中看 `x / y / width / height / scale / rotation` 等布局属性。
6. [bounds](../../leafer-docs/reference/UI/bounds.md)
   对齐、命中、局部渲染和锚点计算的基础。
7. [自动布局](../../leafer-docs/guide/plugin/flow.md)
   先看理念，再进入 Flow 详细属性。
8. [设置样式](../../leafer-docs/guide/basic/style.md)
   建立 Leafer 样式系统的直觉。
9. [交互状态](../../leafer-docs/guide/plugin/state.md)
   建立 `hover / press / selected / disabled` 的状态样式心智模型。
10. [局部渲染](../../leafer-docs/guide/advanced/partRender.md)
    用于后续优化节点重绘和 UI 更新策略。

---

## 2. 布局系统索引

### 2.1 场景结构与分层容器

- [创建 App 应用](../../leafer-docs/guide/advanced/app.md)
  讲 `App` 的推荐结构，以及适合图形编辑器的分层思路。
- [App](../../leafer-docs/reference/display/App.md)
  运行时容器参考，适合对照我们现在的 `ground / tree / sky` 容器设计。
- [Leafer-tree](../../leafer-docs/guide/design/tree.md)
  讲树结构、布局、渲染、事件的底层模型。
- [Group 元素](../../leafer-docs/reference/display/Group.md)
  适合定义节点容器、图层容器、组合容器。
- [Box 元素](../../leafer-docs/reference/display/Box.md)
  同时具备容器能力和可见外观，适合 modern 节点壳体。
- [Frame 元素](../../leafer-docs/reference/display/Frame.md)
  适合理解裁剪、画板和固定区域容器。

### 2.2 坐标、边界与视口

- [转换坐标](../../leafer-docs/guide/advanced/coordinate.md)
  本仓 viewport 命中、拖拽、widget 点击、端口锚点必须反复参考。
- [获取包围盒](../../leafer-docs/guide/advanced/bounds.md)
  用于理解 `box/render/stroke/world` 各种边界。
- [缩放平移视图](../../leafer-docs/guide/advanced/viewport.md)
  视口交互总览，和 `@leafer-in/viewport`、`@leafer-in/view` 配套。
- [视图控制](../../leafer-docs/plugin/in/view/index.md)
  视图缩放、fit、聚焦元素、聚焦区域的插件入口。
- [layout](../../leafer-docs/reference/UI/layout.md)
  布局属性总入口。
- [position](../../leafer-docs/reference/UI/position.md)
  适合看绝对定位与 `move()` 一类增量位移方法。
- [size](../../leafer-docs/reference/UI/size.md)
  宽高、自适应宽高、尺寸约束。
- [transform](../../leafer-docs/reference/UI/transform.md)
  变换矩阵、世界矩阵和局部矩阵。
- [bounds](../../leafer-docs/reference/UI/bounds.md)
  精确解释 `boxBounds / renderBounds / worldBoxBounds / worldRenderBounds`。
- [元素生命周期](../../leafer-docs/guide/life/ui.md)
  适合理解创建、挂载、移除、销毁时机，避免布局初始化过早或过晚。

### 2.3 自动布局与排版

- [自动布局](../../leafer-docs/guide/plugin/flow.md)
  自动布局概念入口，适合理解 Leafer 的 Flow 能力。
- [Flow 元素](../../leafer-docs/plugin/in/flow/index.md)
  Flow 插件主文档，适合看安装方式、继承结构和使用限制。

Flow 详细属性页：

- [布局方向](../../leafer-docs/plugin/in/flow/Flow/flow.md)
- [间距](../../leafer-docs/plugin/in/flow/Flow/gap.md)
- [内边距](../../leafer-docs/plugin/in/flow/Flow/padding.md)
- [对齐](../../leafer-docs/plugin/in/flow/Flow/flowAlign.md)
- [自动换行](../../leafer-docs/plugin/in/flow/Flow/flowWrap.md)
- [加入布局](../../leafer-docs/plugin/in/flow/Flow/inFlow.md)
- [盒类型](../../leafer-docs/plugin/in/flow/Flow/itemBox.md)
- [自动宽度](../../leafer-docs/plugin/in/flow/Flow/autoWidth.md)
- [自动高度](../../leafer-docs/plugin/in/flow/Flow/autoHeight.md)
- [限制宽度](../../leafer-docs/plugin/in/flow/Flow/widthRange.md)
- [限制高度](../../leafer-docs/plugin/in/flow/Flow/heightRange.md)
- [锁定比例](../../leafer-docs/plugin/in/flow/Flow/lockRatio.md)

### 2.4 渲染与性能

- [局部渲染](../../leafer-docs/guide/advanced/partRender.md)
  对 modern 节点 patch、局部刷新、包围盒变化控制最关键。
- [创建 App 应用](../../leafer-docs/guide/advanced/app.md)
  适合理解为什么不同更新频率的内容应拆到不同 Leafer 层。

---

## 3. UI 结构与视觉样式索引

### 3.1 元素创建与基础构件

- [创建元素](../../leafer-docs/guide/basic/display.md)
  适合快速建立 Leafer 元素创建方式的直觉。
- [UI 元素](../../leafer-docs/reference/display/UI.md)
  所有可视元素的基类，是查通用属性和方法的总入口。
- [Rect 元素](../../leafer-docs/reference/display/Rect.md)
  适合节点壳体、按钮背景、选中框。
- [Text 元素](../../leafer-docs/reference/display/Text.md)
  适合标题、标签、摘要文本和 widget 文本。
- [Group 元素](../../leafer-docs/reference/display/Group.md)
  适合纯容器分组。
- [Box 元素](../../leafer-docs/reference/display/Box.md)
  适合可见且可装子元素的 UI 容器。
- [Frame 元素](../../leafer-docs/reference/display/Frame.md)
  适合裁剪区域和固定画板式区域。

### 3.2 基础视觉样式

- [设置样式](../../leafer-docs/guide/basic/style.md)
  样式修改入口。
- [fill](../../leafer-docs/reference/UI/fill.md)
  背景与文本填充。
- [stroke](../../leafer-docs/reference/UI/stroke.md)
  描边与边框风格。
- [Corner](../../leafer-docs/reference/UI/corner.md)
  圆角与圆角平滑。
- [shadow](../../leafer-docs/reference/UI/shadow.md)
  外阴影。
- [transform](../../leafer-docs/reference/UI/transform.md)
  视觉变换同样影响 UI 观感和交互热区。

### 3.3 交互状态样式

- [交互状态](../../leafer-docs/guide/plugin/state.md)
  状态样式概念入口。
- [交互状态](../../leafer-docs/plugin/in/state/index.md)
  `@leafer-in/state` 插件主入口。
- [state](../../leafer-docs/reference/UI/state/state.md)
  通用状态系统入口。
- [hover](../../leafer-docs/reference/UI/state/hover.md)
- [press](../../leafer-docs/reference/UI/state/press.md)
- [focus](../../leafer-docs/reference/UI/state/focus.md)
- [selected](../../leafer-docs/reference/UI/state/selected.md)
- [disabled](../../leafer-docs/reference/UI/state/disabled.md)

---

## 4. 设计器与编辑态样式索引

这些文档更偏“设计器能力”，但对节点编辑壳、选中框、控制柄、编辑态高亮很有参考价值。

- [Editor 元素](../../leafer-docs/plugin/in/editor/index.md)
  图形编辑器总入口，适合理解编辑态容器和编辑工具体系。
- [编辑器配置 / 样式](../../leafer-docs/plugin/in/editor/config/style.md)
  编辑框、控制点、描边样式等配置。

相关配置分支：

- [基础配置](../../leafer-docs/plugin/in/editor/config/base.md)
- [按钮组配置](../../leafer-docs/plugin/in/editor/config/buttons.md)
- [光标配置](../../leafer-docs/plugin/in/editor/config/cursor.md)
- [选择配置](../../leafer-docs/plugin/in/editor/config/select.md)
- [控制配置](../../leafer-docs/plugin/in/editor/config/control.md)
- [启用配置](../../leafer-docs/plugin/in/editor/config/enable.md)
- [事件配置](../../leafer-docs/plugin/in/editor/config/event.md)
- [内部编辑器配置](../../leafer-docs/plugin/in/editor/config/innerEditor.md)

---

## 5. 按迁移场景查阅

### 5.1 设计 modern 节点壳体

优先读：

- [Box 元素](../../leafer-docs/reference/display/Box.md)
- [Group 元素](../../leafer-docs/reference/display/Group.md)
- [Rect 元素](../../leafer-docs/reference/display/Rect.md)
- [Text 元素](../../leafer-docs/reference/display/Text.md)
- [设置样式](../../leafer-docs/guide/basic/style.md)

### 5.2 处理节点布局、折叠宽度、slot 几何与锚点

优先读：

- [Leafer-tree](../../leafer-docs/guide/design/tree.md)
- [layout](../../leafer-docs/reference/UI/layout.md)
- [position](../../leafer-docs/reference/UI/position.md)
- [size](../../leafer-docs/reference/UI/size.md)
- [transform](../../leafer-docs/reference/UI/transform.md)
- [bounds](../../leafer-docs/reference/UI/bounds.md)
- [转换坐标](../../leafer-docs/guide/advanced/coordinate.md)

### 5.3 处理缩放、平移、聚焦和命中坐标

优先读：

- [缩放平移视图](../../leafer-docs/guide/advanced/viewport.md)
- [视图控制](../../leafer-docs/plugin/in/view/index.md)
- [转换坐标](../../leafer-docs/guide/advanced/coordinate.md)
- [bounds](../../leafer-docs/reference/UI/bounds.md)

### 5.4 设计 widget 与节点状态样式

优先读：

- [交互状态](../../leafer-docs/guide/plugin/state.md)
- [交互状态插件](../../leafer-docs/plugin/in/state/index.md)
- [hover](../../leafer-docs/reference/UI/state/hover.md)
- [press](../../leafer-docs/reference/UI/state/press.md)
- [selected](../../leafer-docs/reference/UI/state/selected.md)
- [disabled](../../leafer-docs/reference/UI/state/disabled.md)

### 5.5 想用自动布局替代手写排版

优先读：

- [自动布局](../../leafer-docs/guide/plugin/flow.md)
- [Flow 元素](../../leafer-docs/plugin/in/flow/index.md)
- [布局方向](../../leafer-docs/plugin/in/flow/Flow/flow.md)
- [间距](../../leafer-docs/plugin/in/flow/Flow/gap.md)
- [内边距](../../leafer-docs/plugin/in/flow/Flow/padding.md)
- [对齐](../../leafer-docs/plugin/in/flow/Flow/flowAlign.md)
- [自动换行](../../leafer-docs/plugin/in/flow/Flow/flowWrap.md)

### 5.6 想优化节点更新与重绘性能

优先读：

- [局部渲染](../../leafer-docs/guide/advanced/partRender.md)
- [获取包围盒](../../leafer-docs/guide/advanced/bounds.md)
- [创建 App 应用](../../leafer-docs/guide/advanced/app.md)

---

## 6. 与本仓 Leafer 迁移最直接相关的结论

1. `App / ground / tree / sky` 的分层设计有官方文档依据，优先参考 App 体系而不是单层 canvas 思维。
2. 命中测试、拖拽、widget 坐标问题的文档根基是“坐标转换 + bounds + transform”，不是单纯看事件 API。
3. Modern Node 的视觉壳体更适合建立在 `Box / Group / Rect / Text` 这组基础元素上。
4. 状态样式应优先依赖 `@leafer-in/state`，而不是继续沿用 legacy 的人工 hover/press 染色逻辑。
5. 如果后续要进一步做节点内自动排版，Flow 是首选参考，但要注意文档已明确提示其与图形编辑能力并非天然混用。
6. 局部渲染文档对我们继续压缩 modern 节点 patch 成本非常关键，应与节点 bounds 设计一起看。

