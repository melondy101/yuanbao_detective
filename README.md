# AI 侦探社 🕵️

WaytoAGI 1024 切磋大会 · 侦探赛道作品。**丢给它一个问题，它去全网查清楚，带着证据回来。**

核心引擎是腾讯云**元宝搜索**（wsa `SearchPro` 接口）：去掉元宝搜索，本作品就转不起来。

## 功能

- **深度调查**：输入一个难题 → 自动拆解成 3-5 个检索词 → 并行真实联网搜索（自然结果 + VR 权威信源）→ 交叉比对 → 输出三分法调查报告：
  - 🔎 **已知事实**：每条都挂可点开的来源编号；
  - 🧠 **推断**：写明依据，与事实分开；
  - ❓ **查不到 / 待验证**：敢说不知道，不编造；
  - ⚔️ **来源冲突**：不同信源说法不一 时摆出来对比，并标注信息时效。
- **持续盯梢**：调查完成后一键「加入盯梢」（也可直接添加问题），按周期自动重新搜索、保存快照、对比变化，有变化就标 ⚠ 提醒。

## 快速开始

```bash
cd web
npm install
cp .env.example .env.local   # 填入三个值：腾讯云 SecretId/SecretKey + 任意 OpenAI 兼容 LLM Key
npm run dev                  # http://localhost:3000
```

密钥就绪后先访问 `http://localhost:3000/api/smoke` 验证元宝搜索链路（返回 `ok: true` 即打通）。

## 合规设计（对齐 docs/接口规则.md）

- **密钥安全**：SecretId/SecretKey/LLM Key 一律环境变量（`.env.local`），不进代码不进仓库；TC3-HMAC-SHA256 签名在服务端完成，浏览器拿不到密钥。
- **额度节约**：相同查询 10 分钟内走本地缓存（命中不消耗额度）；检索并发 3，远低于 QPS 限制；每次调用落审计日志（Query / 时间 / 是否命中缓存）。
- **限流与错误**：429 指数退避重试（1s/2s/4s，最多 3 次）；鉴权失败立即停止；任何失败都不展示假结果。
- **题材红线**：输入层关键词初筛 + 拆题模型语义复审，涉及时政/个人隐私直接拒绝；输出层对命中敏感词的结果做过滤不展示。
- **来源可追溯**：`url` 原样透传自搜索接口，模型只引用来源编号、不生成链接，从机制上杜绝编造出处。

## 部署

任意 Node 平台均可（Vercel 为例）：导入仓库，Root Directory 设为 `web`，在环境变量里配置 `TENCENTCLOUD_SECRET_ID` / `TENCENTCLOUD_SECRET_KEY` / `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`。

## 目录

```
docs/                  赛道规则、接口硬约束、选题决策（单一权威来源）
web/                   Next.js 应用
  src/lib/tencent.ts       SearchPro 客户端（TC3 手写签名 + 限流重试）
  src/lib/orchestrator.ts  深度调查编排（拆题→并行检索→交叉比对→成稿）
  src/lib/searchCache.ts   结果缓存（TTL 10 分钟）与调用审计日志
  src/lib/redline.ts       时政/个人隐私红线过滤（输入层 + 输出层）
  src/app/api/             investigate（调查）/ watch/run（盯梢快照）/ smoke（链路自检）
  src/components/          深度调查 Tab / 报告渲染 / 持续盯梢 Tab
```

## 话题

`#元宝搜索 #WaytoAGI #AI切磋大会 #1024超能Coding周末`
