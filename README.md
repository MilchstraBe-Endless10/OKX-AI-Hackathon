# SOPscape Council

SOPscape Council 把静态 SOP 转换成可决策、可验证、可分享的 AI 情境演练。

它不是普通的 SOP 总结器，也不是带 3D 背景的聊天机器人。系统让三名职责不同的 AI 专家分别分析流程、风险和证据，再由主持人保留共识、分歧与证据缺口，最终生成结构化报告和可玩的 3D 决策演练。

## 从这里开始

- [项目详细说明](PROJECT_OVERVIEW.zh-CN.md)：项目解决什么问题、如何工作、3D/A2MCP/MCP 的作用和完整用户流程。
- [产品功能、API 与验收清单](docs/PRODUCT_PLATFORM.zh-CN.md)：完整模块、API、安全边界和完成度。
- [部署与 OKX.AI 上架](docs/DEPLOYMENT.md)
- [开发执行与验证手册](.omx/plans/sopscape-council-development-execution-verification.zh-CN.md)

## 当前状态

当前仓库已具备可运行的纵向产品闭环：

- **身份认证**：邮箱密码登录、HttpOnly Session Cookie、RBAC（Owner/Editor/Viewer）
- **邀请系统**：一次性邀请 token、48 小时有效、HMAC 摘要存储
- **团队管理**：成员列表、角色修改、成员移除、防最后一个 owner 降级
- **SOP 核心**：三专家评审、数字护照、BLOCK/WARN/READY 门禁
- **3D 指挥室**：Three.js 单一渲染循环、风险路径、分支决策
- **版本管理**：SOP 历史、版本风险比较、决策回放
- **训练系统**：训练分配、完成评分、审计报告
- **安全分享**：只读分享链接、过期/次数限制、/r/:token 报告页
- **A2MCP**：Bearer 鉴权、限流、58s Deadline、审计日志
- **MCP**：官方 SDK 无状态基线（Streamable HTTP）
- **国际化**：10 种语言菜单、深色/浅色/系统主题

```bash
pnpm install
pnpm --filter @sopscape/server dev
# 另一个终端
pnpm --filter @sopscape/web dev
```

默认使用确定性 Demo Provider（无需 API Key）。配置 `MODEL_API_KEY` / `MODEL_BASE_URL` / `MODEL_NAME` 后可接入真实 OpenAI 兼容模型。

Web 与 API 默认通过 Vite 开发代理协作；生产环境建议用 Nginx/平台网关终止 HTTPS，
再反向代理到 Node 服务。

## 两人分工

- 开发者 A：Contracts、Core、PostgreSQL、Web API、A2MCP、MCP 和部署。
- 开发者 B：React、Three.js、GSAP、六个 UI 组件、决策体验、E2E 与前端性能。

先合并 Contracts 和 Fixture，前后端再通过独立 Worktree 并行开发。任何功能都通过 PR、另一人审查、Hunk 和 CI 后进入 `main`。
