# SOPscape Council

SOPscape Council 将一段 SOP 转换为可执行、可审查、可复盘的 AI 决策演练。三名职责不同的专家分别分析流程、风险和证据，系统保留共识、分歧与证据缺口，再把结果映射到 3D 指挥室中的分支决策、数字护照和可分享报告。

它不是普通的 SOP 总结器，也不是带 3D 背景的聊天机器人：每个结论都必须经过结构化 Schema 校验，专家不完整时不会伪装成成功结果。

## 当前版本

`feat/integration` 已包含前端验收 PR #7 的合并提交 `2c72e73`。当前比赛版本的产品边界是单工作区 `workspace-demo`：

- **身份与权限**：邮箱登录、HttpOnly Session、Owner/Editor/Viewer RBAC；
- **SOP 演练**：三专家并行分析、共识/分歧/证据缺口、决策节点、数字护照；
- **3D 指挥室**：Three.js 单一 Render Loop、风险路径、分支决策、移动端降级；
- **团队能力**：邀请、成员管理、历史记录、版本比较、训练与审计；
- **分享与协议**：只读分享报告、A2MCP、无状态 Streamable HTTP MCP；
- **可靠性与安全**：58 秒 Deadline、502/504 Problem Details、限流、CSP、安全响应头；
- **前端体验**：深色/浅色/跟随系统主题，10 种语言菜单，键盘与 reduced-motion 支持。

生产发布仍必须从合并后的集成提交创建 Release Candidate，重新部署 Railway，并重新执行真实模型、浏览器和性能验收。不要把本地 Demo 测试或旧 Railway 部署当作最终发布证据。

## 架构

```text
apps/web           React + Three.js + GSAP 指挥室
apps/server        Fastify API、认证、持久化、A2MCP、MCP
packages/contracts Zod 运行时 Schema：SopInput、CouncilResult、Scene、ApiError
packages/core      专家编排、Provider 恢复链、生命周期与决策生成
tests/fixtures     成功、失败、部分失败和 Schema 边界 Fixture
```

Contract 是唯一事实来源。前端只能消费已合并的 Contract/Fixture，不得复制领域类型；服务端只能在三名专家均有效时启动 Moderator。

## 本地运行

```bash
pnpm install
pnpm --filter @sopscape/server dev  # 终端 1
pnpm --filter @sopscape/web dev     # 终端 2
```

默认使用确定性 Demo Provider。配置 `MODEL_API_KEY` / `MODEL_BASE_URL` / `MODEL_NAME` 后可接入真实 OpenAI 兼容模型。密钥只写入本机或 Railway Secret，不提交到 Git。

## 验证

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test                 # unit + fixtures
pnpm build
pnpm verify
```

生产验收脚本需要真实环境变量和目标 URL，不能用 FakeProvider 冒充：

```bash
bash scripts/prod-verify-10round.sh https://your-host.example
bash scripts/prod-verify-error-contracts.sh https://your-host.example
```

浏览器证据见 [docs/WEB_ACCEPTANCE_REPORT.zh-CN.md](docs/WEB_ACCEPTANCE_REPORT.zh-CN.md)。真实 Chromium 登录闭环、生产部署 SHA 和性能 trace 必须在 Release Candidate 上重新记录。

## 部署与上架

- [生产部署](docs/PRODUCTION_DEPLOYMENT.md)
- [OKX.AI 上架验证](docs/OKX_AI_LISTING.md)
- [提交材料包](docs/OKX_AI_SUBMISSION_PACKAGE.zh-CN.md)

```text
feat/integration
→ feat/release-candidate
→ Railway 重新部署
→ health / security / error contract
→ 真实模型 10/10
→ 浏览器与性能验收
→ ASP / 90 秒视频 / X / Google Form
```

## 双人协作

- **开发者 A**：`packages/contracts`、`packages/core`、`apps/server`、数据库、A2MCP、MCP、部署与生产验证。
- **开发者 B**：`apps/web`、React/Three.js/GSAP、交互、无障碍、浏览器 E2E 与前端性能证据。

详细分支、Worktree、Review、Hunk、回退和安全规则见 [CONTRIBUTING.md](CONTRIBUTING.md)。实时状态以 GitHub Issue、Project、PR 和 CI 为准。
