# OKX.AI 上架执行清单

## 上架对象

- 类型：A2MCP
- 计费：免费，价格填 `0`
- Endpoint：`https://sopscape-production.up.railway.app/a2mcp/generate-rehearsal`
- Method：`POST`
- Content-Type：`application/json`
- x402：Hackathon 期间不启用

OKX.AI 允许免费 A2MCP endpoint 直接返回 HTTP 200；注册时需要服务名称、描述、价格和 endpoint。审核通常在 24 小时内完成，因此必须尽早提交。

官方资料：

- [ASP 注册流程](https://web3.okx.com/zh-hans/onchainos/dev-docs/okxai/registerasp)
- [A2MCP 指南](https://web3.okx.com/zh-hans/onchainos/dev-docs/okxai/howtomcp)
- [Hackathon 页面](https://www.hackquest.io/hackathons/OKXAI-Genesis-Hackathon)

## Railway 必需变量

```text
NODE_ENV=production
SOPSCAPE_DATABASE_PATH=/app/data/sopscape.sqlite
SOPSCAPE_REQUIRE_AUTH=true
SOPSCAPE_OWNER_PASSWORD=<sealed>
SOPSCAPE_SESSION_SECRET=<sealed>
SOPSCAPE_API_KEY=<sealed>
MODEL_API_KEY=<sealed>
MODEL_BASE_URL=<provider base URL>
MODEL_NAME=<model>
PUBLIC_APP_ORIGIN=https://sopscape-production.up.railway.app
OKX_PUBLIC_FREE_A2MCP=true
PUBLIC_A2MCP_RATE_LIMIT_PER_MINUTE=6
```

`OKX_PUBLIC_FREE_A2MCP=true` 只公开比赛注册所需的
`/a2mcp/generate-rehearsal`。标准 `/mcp` 和其他服务接口继续要求 Bearer Token。

## 请求格式

```json
{
  "title": "Phishing email response",
  "content": "Do not click embedded links. Verify the sender independently, preserve evidence, and report the message to the security team.",
  "locale": "en-US"
}
```

成功响应必须包含：

```text
rehearsalId
status
consensus[]
disagreements[]
evidenceGaps[]
recommendedPath[]
decisionNodes[]
```

## 自动预检

部署候选版本后运行：

```bash
pnpm verify:listing -- https://sopscape-production.up.railway.app
```

它验证：

- HTTPS Web 与健康检查
- Readiness 200
- 非法输入 400
- 免费 A2MCP 直接返回 200
- 结构化 Council 结果
- 没有 x402 支付挑战头
- `/mcp` 仍受 Bearer Token 保护

## Onchain OS 注册

安装并登录：

```text
通过 npx skills add okx/onchainos-skills --yes -g 安装 Onchain OS，完成后用邮箱登录 Agentic Wallet。
```

注册提示词：

```text
帮我使用 Onchain OS 的 OKX Agent Identity 在 OKX.AI 注册一个 A2MCP 类型的 ASP。

服务名称：SOPscape Council
价格：0
Endpoint：https://sopscape-production.up.railway.app/a2mcp/generate-rehearsal
描述：将静态 SOP 转换为由三名专业 AI 代理共同审查的风险决策演练，返回共识、分歧、证据缺口、建议路径和结构化决策节点，适用于安全培训、流程审查与团队演练。
```

提交上架：

```text
帮我将刚刚注册的 SOPscape Council ASP 上架到 OKX.AI。
```

## 审核通过证据

保存以下内容：

- ASP 注册 ID
- 上架页面 URL
- 审核提交时间
- 审核通过邮件截图
- Marketplace 在线页面截图
- OKX.AI 内实际调用成功截图
- Endpoint 调用日志时间与 requestId

只有 ASP 审核通过并上线，Hackathon 提交才有效。
