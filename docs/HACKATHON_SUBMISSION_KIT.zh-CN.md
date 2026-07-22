# SOPscape Council｜OKX.AI Genesis Hackathon 提交包

> 状态：可直接用于录制和填写的候选稿。`[方括号]` 内容必须在正式提交前替换。
> 截止：2026-07-27 23:59 UTC。演示视频不得超过 90 秒，X 帖子必须包含 `#OKXAI`。

## 一句话定位

SOPscape Council 把静态 SOP 转化为可追踪的多智能体决策演练：流程分析员、风险挑战者和证据审计员先形成共识与分歧，再把决策后果映射成可交互的 3D 风险拓扑。

## 90 秒演示脚本

录制要求：1920×1080、Chrome 桌面端、浏览器缩放 100%、关闭通知；从空白输入态开始，整段控制在 **86–89 秒**，不要展示终端或密钥。

| 时间 | 屏幕操作 | 旁白 |
|---|---|---|
| 0–7 秒 | 标题卡后进入空白指挥室 | “企业有大量 SOP，但员工真正遇到风险时，文字并不能证明他会做出正确决策。” |
| 7–17 秒 | 输入“钓鱼邮件响应流程”及示例 SOP | “SOPscape Council 将任何文字流程变成一次可审议、可追踪的决策演练。” |
| 17–29 秒 | 点击“启动议会演练”，展示三专家运行状态 | “通过 A2MCP，一个请求并行调度流程分析、风险挑战和证据审计三个专家。” |
| 29–43 秒 | 结果出现，依次指向共识、分歧和证据缺口 | “它们不会只给一个黑盒答案，而会显式呈现共识、分歧、置信度以及仍然缺失的证据。” |
| 43–55 秒 | 切换“共识、风险、证据”，按住鼠标中键环视 3D 场景 | “这些结构化结果被映射到同一个可 360 度环视的 3D 指挥室，让团队直观看到决策关系和风险传播路径。” |
| 55–66 秒 | 点击高风险选项“执行” | “如果用户直接执行可疑链接，核心进入告警态，风险链路立即被激活。” |
| 66–76 秒 | 点击安全选项“复核后执行” | “选择独立核验后，风险路径收束，系统记录安全处置依据。” |
| 76–85 秒 | 停在完整结果画面 | “它适用于安全响应、运维操作、客户服务和任何需要训练判断力的 SOP。” |
| 85–89 秒 | 项目 Logo 与 `Built for OKX.AI` | “SOPscape Council：不只阅读流程，而是先演练每一次关键决定。” |

### 录制前固定演示数据

- 标题：`钓鱼邮件响应流程`
- SOP 正文：`收到要求立即重置密码的邮件时，不点击邮件内链接。通过公司通讯录联系发件人核验，保留邮件原文并上报安全团队；若已点击，立即断开网络、修改凭证并联系值班人员。`
- 高风险选择：`执行`
- 安全选择：`复核后执行`

## X 帖子候选稿

### 中文版

我们做了 **SOPscape Council**：把静态 SOP 变成多智能体决策演练。流程分析员、风险挑战者与证据审计员通过 A2MCP 并行审议，再把共识、分歧、证据缺口和决策后果映射成可交互的 3D 风险拓扑。不是再读一遍流程，而是在事故发生前练习关键决定。🎬 [90 秒演示链接] 🔗 [OKX.AI ASP 链接] #OKXAI

### 英文版

Meet **SOPscape Council** — an agent-native service that turns static SOPs into interactive decision rehearsals. Three AI specialists expose consensus, disagreements and evidence gaps through A2MCP, then map each choice into a live 3D risk topology. Don’t just read a procedure. Rehearse the decision before it matters. 🎬 [90s demo] 🔗 [OKX.AI ASP] #OKXAI

## Google Form 填写材料

| 字段 | 建议填写内容 |
|---|---|
| Project name | SOPscape Council |
| Category | AI Agent / Productivity / Training / Risk Management |
| One-liner | 将静态 SOP 转化为可追踪、可交互的多智能体 3D 决策演练。 |
| Problem | 传统 SOP 只能描述标准步骤，无法验证成员在模糊或高风险场景中的实际判断，也难以暴露流程中的分歧与证据缺口。 |
| Solution | 用户提交 SOP 后，三个专业 Agent 分别检查流程完整性、风险后果和证据质量；Moderator 汇总结构化结论，前端把共识、分歧、证据缺口与决策后果映射到 3D 指挥室。 |
| Target users | 安全团队、运维团队、客户服务团队、合规培训负责人，以及需要把知识流程转化为实际训练的个人和组织。 |
| Key use case | 钓鱼邮件响应：用户在高风险与安全操作之间做出选择，界面实时展示风险路径变化并解释结果。 |
| Innovation | 多 Agent 不只生成答案，而是公开彼此的共识、冲突和证据不足；结构化 CouncilResult 同时驱动文字解释与单一 Three.js 场景，使推理过程可追踪、结果可演练。 |
| How it uses OKX.AI | 以 ASP 形式提供 SOP 决策演练服务，通过 A2MCP 暴露生成能力；比赛期间免费调用，赛后计划使用 OKX Payment SDK 接入按次收费的 x402。 |
| Tech stack | React 19、TypeScript、Three.js、GSAP、Node.js、PostgreSQL、运行时 Schema、A2MCP；支持浅色、深色、跟随系统主题和 10 种界面语言。 |
| Current status | Web 指挥室与真实 A2MCP HTTP 纵向链路已完成；正式提交前必须完成真实模型 Provider、公开部署和 OKX.AI 内部审核。 |
| Team | 开发者 A：[姓名]——Core、Provider、A2MCP、部署；开发者 B：[姓名]——产品、Web、3D 交互、演示与提交。 |
| Repository | [GitHub 仓库链接] |
| Live demo | [公开 HTTPS 演示链接] |
| OKX.AI ASP | [审核通过并上线的 ASP 链接] |
| X post | [包含 #OKXAI 的 X 帖子链接] |
| Demo video | [不超过 90 秒的视频链接] |

## 提交前硬门槛

### 产品与服务

- [ ] 开发者 A 用真实模型 Provider 替换 `FakeProvider`，并保留超时、并行调度和 Schema 校验。
- [ ] Web、Server 与 Provider 部署到公开 HTTPS 地址，禁止把密钥写入仓库或前端。
- [ ] 使用固定演示 SOP 完成至少 3 次端到端成功调用，并验证失败状态不会泄漏内部错误或密钥。
- [ ] ASP 在比赛期间保持免费；赛后 x402 只作为路线图表述，不在本次提交前临时接入。

### OKX.AI 与比赛

- [ ] ASP 已提交 OKX.AI，并通过内部审核且实际上线；未通过审核或未上线即不具备参赛资格。
- [ ] X 帖子包含 `#OKXAI`、明确使用场景和不超过 90 秒的演示。
- [ ] Google Form 中的 ASP、演示、仓库与 X 链接均可公开访问。
- [ ] 在 **2026-07-27 23:59 UTC** 前完成 Google Form 提交并保存回执截图。

### 演示质量

- [ ] 视频时长 86–89 秒，旁白清楚，无加载空白、通知弹窗、Token 或本地地址。
- [ ] 先展示问题，再展示 Agent 审议，最后演示高风险与安全选择的 3D 因果变化。
- [ ] 所有公开材料只描述已验证能力；真实 Provider 未上线前，不宣称系统已由生产模型驱动。
