# AI 调用说明（Bun + Vite）

本文定义本仓库关于 AI 调用与工具链的约定：

- 前端/JS 侧：使用 **Bun** 管理依赖与执行脚本
- 打包侧：使用 **Vite** 产出 `dist/` 库文件
- AI 调用：默认走**后端代理**，前端不直接暴露密钥

## 1. 总体原则

## 1.1 不在浏览器暴露 AI 密钥

- 禁止把 API Key 写在前端 JS、HTML、公开配置文件中。
- 推荐在服务端创建代理接口：
  - 前端 -> `/api/ai/*`
  - 服务端 -> 第三方 AI API

## 1.2 调用链建议

1. 前端收集用户输入（prompt、上下文、参数）。
2. 前端请求后端代理（带业务鉴权）。
3. 后端注入密钥并调用 AI 服务。
4. 后端返回最小必要数据给前端（避免泄露原始响应中的敏感字段）。

## 1.3 记录与审计

- 记录 request id、模型名、token 消耗、耗时和错误码。
- 记录脱敏后的 prompt（或哈希）。
- 对失败调用做可追踪日志，避免仅在前端报错。

## 2. Bun 工作流（前端/JS）

当前仓库脚本已按 Bun 约定配置到 `package.json`。

常用命令：

```bash
bun install
bun run build
bun run test
bun run lint
bun run prettier
```

说明：

- 包管理器通过 `packageManager` 固定为 `bun@1.2.21`。
- 工具调用统一使用 `bunx`（如 `bunx jest`、`bunx eslint`）。
- `bun run build` 会通过 Vite 构建脚本输出：
  - `dist/litegraph.core(.min).js`
  - `dist/litegraph.basic(.min).js`
  - `dist/litegraph.extended(.min).js`

## 4. AI 代理接口最小示例（Node/Bun 服务端）

以下示例只展示“前端不持有密钥”的架构模式：

```js
import express from "express";

const app = express();
app.use(express.json());

app.post("/api/ai/chat", async (req, res) => {
  try {
    const { messages, model } = req.body;

    const r = await fetch(process.env.AI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AI_API_KEY}`
      },
      body: JSON.stringify({
        model: model || "your-model",
        messages
      })
    });

    if (!r.ok) {
      const errText = await r.text();
      return res.status(r.status).json({ error: errText });
    }

    const data = await r.json();
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
});
```

前端只调用：

```js
await fetch("/api/ai/chat", { method: "POST", body: JSON.stringify(payload) });
```

## 5. 推荐的环境变量

建议在服务端读取，避免提交到仓库：

- `AI_API_URL`
- `AI_API_KEY`
- `AI_MODEL_DEFAULT`

## 6. 安全清单

- 对外接口加鉴权与限流（按用户/IP）。
- 对 prompt 做长度限制与敏感词过滤。
- 不把完整原始异常直接透传给前端。
- 对上传内容做类型和大小校验。

## 7. 与本仓库相关的落地点

- JS/Bun 脚本入口：`package.json`
- Vite 构建脚本：`scripts/build-dist.mjs`
- Bundle 清单：`scripts/bundle-manifest.mjs`
- 文档导航：`guides/README.md`
