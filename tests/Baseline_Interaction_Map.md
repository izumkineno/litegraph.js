# Baseline Interaction Map (Old Version)

## 环境信息
- 基线地址：`http://127.0.0.1:5500/editor/`
- 视口：`1440 x 900`
- 画布元素：`canvas`（首个）
- 采集方式：Playwright MCP（真实鼠标事件 + DOM 查询）

## 标准路径采集结果

| 步骤 | 触发方式 | 坐标 / 定位器 | 预期视觉反馈 | 实际结果 |
|---|---|---|---|---|
| A: 画布中央右键唤出菜单 | 在 canvas 中心右键点击 | 坐标：`(717, 444)`；定位器：`canvas` | 出现 Context Menu | 菜单出现：`.litecontextmenu`，菜单框约 `left=707, top=434, w=100, h=42`，条目含 `Add Node`、`Add Group` |
| B: 通过菜单添加基础节点 | 依次点击菜单项 | 1) `Add Node`：`(757, 445)`，`.litecontextmenu .litemenu-entry`(text=Add Node)  2) `basic`：`(857, 466)`，`.litecontextmenu .litemenu-entry`(text=basic)  3) `Const Number`：`(957, 539)`，`.litecontextmenu .litemenu-entry`(text=Const Number) | 新节点创建在右键点附近 | 成功创建节点：`id=1`，`type=basic/const`，`title=Const Number`；图坐标 `pos=(717,404)`，尺寸 `180x30`，屏幕中心约 `(807,419)` |
| C: 拖拽节点到新位置 | 左键按住节点并拖动后松开 | 起点 `(807, 419)` -> 终点 `(1027, 559)`；定位依据：节点屏幕中心 | 节点跟随移动，松开后位置固定 | 位置更新成功：`pos (717,404) -> (937,544)`，新屏幕中心 `(1027,559)` |
| D: 双击节点打开属性面板并关闭 | 双击节点中心，点击关闭按钮 | 双击坐标：`(1027,559)`；面板：`.litegraph.dialog.settings`；关闭按钮：`.litegraph.dialog.settings .close`，点击坐标 `(392,67)` | 弹出节点设置面板，关闭后消失 | 面板成功打开（约 `left=10, top=50, w=400, h=800`），关闭后 `dialogExists=false` |

## 备注
- 旧版菜单路径中，“Basic -> Number”在当前页面实际文案为 `basic -> Const Number`，功能等价（创建基础常量数字节点）。
- 若后续基线脚本需要固定文本匹配，建议优先匹配 `type=basic/const` 或菜单文案 `Const Number`。

## 控制台健康度（全程）
- `console.error`：`0`
- `pageerror`（未捕获异常）：`0`
- `unhandledrejection`：`0`

结论：在上述 A-D 标准交互路径下，旧版基线程序未出现控制台报错或未捕获异常。

