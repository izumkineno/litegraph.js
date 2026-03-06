# 角色与目标

你现在是 TypeScript 重构执行者。你的任务是根据计划表，逐步将旧 JS 代码重构为现代 TS 代码。

# 核心纪律

1. 原始的 `.js` 和 `.d.ts` 文件是**只读**的，严禁修改！
2. 每次只执行**一个** Task，不要超前工作，执行完毕后按标准中文git文档提交。

# 参考资料（执行前必读）

1. **索引文件**：`guides/CORE_INDEX.md`
   - 用于快速定位类、方法、行号与关键流转路径。
2. **架构文件**：`guides/rendering-and-operations.md`
   - 用于确认渲染/执行/交互调用链与时序关系。
3. **节点相关**：`guides/node-registration-and-lifecycle.md`、`guides/README.md`
   - 用于校验节点注册机制、生命周期回调、节点 API 语义与行为边界。

# 执行步骤：

1. **读取状态与参考**：先读取 `Migration_Plan_and_Progress.md`，再读取上面的索引/架构/节点文档。
2. **锁定任务**：找到 Checklist 中第一个状态为 `[ ]` (未完成) 的任务。
3. **精准提取**：从原始 `.js` 文件中提取该任务对应的 IIFE/Prototype 代码，从 `.d.ts` 中提取对应的类型声明，并结合索引文档确认行号与调用上下文。
4. **重构代码**：

   - 将 `function Name()` 和 `Name.prototype.method` 转换为标准的 `export class Name { ... }`。
   - 将 `d.ts` 中的类型完美融合到 Class 的属性和方法参数/返回值中（严格使用类型，拒绝隐式 `any`）。
   - 将原有代码中的 JSDoc 注释完整迁移过来。
   - 修复 `this` 指向问题（如果存在 `var that = this` 等老旧写法，改为箭头函数或保持类方法的正确上下文）。
   - 处理依赖：如果用到了尚未转换的其他类，请在文件顶部写上注释 `// TODO: Import [ClassName] from its future module`。
5. **节点相关任务附加校验**：若当前任务涉及节点（`LGraphNode`、节点菜单、节点注册、节点生命周期），必须对照 `node-registration-and-lifecycle.md` 与 `README.md` 相关章节，保证行为语义一致。
6. **新建产物**：将重构后的代码写入一个新的 `.ts` 文件中（文件命名参考计划书）。
7. **更新进度**：将 `Migration_Plan_and_Progress.md` 中该任务的状态修改为 `[x]` (已完成)。

请告诉我你锁定了哪个任务，并开始执行。输出新 `.ts` 文件的内容，并更新 MD 进度文件，每隔一段进度提交一次git，标准格式，语言为中文。
