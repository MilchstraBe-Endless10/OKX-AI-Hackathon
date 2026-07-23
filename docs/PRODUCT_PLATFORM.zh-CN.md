# SOPscape Council 产品功能、API 与验收清单

## 1. 项目究竟解决什么问题

企业 SOP 通常停留在文档中：员工读过但不会处理真实分支，管理者也不知道某个版本
是否缺证据、是否存在关键风险、培训是否完成。SOPscape Council 将一份静态 SOP
变成一个可追溯的风险决策循环：

1. 导入 TXT、Markdown、JSON、CSV 或 EML；
2. 流程分析员、风险挑战者、证据审计员并行评审；
3. 保存共识、分歧、证据缺口和引用；
4. 生成不可伪造引用关系的 SOP 数字护照；
5. 用 `BLOCK/WARN/READY` 阻止不合格 SOP 发布；
6. 将决策节点投影到唯一的 Three.js 指挥室；
7. 用户选择分支，系统评分、解释后果并给出复盘建议；
8. 保存版本、训练任务、决策记录和审计事件；
9. 导出培训报告，或由 OKX.AI / MCP 客户端调用同一套能力。

首个完整业务模板是"钓鱼邮件响应"。单场景不是缺点：它提供可衡量的安全结果，
同时架构中的决策节点、场景投影和评分器可继续承载账户恢复、付款审批、事故响应等模板。

## 2. 已实现的产品模块

| 模块 | 用户价值 | 实现 |
|---|---|---|
| 3D 议会指挥室 | 看见共识、风险路径和证据节点 | Three.js 单一渲染循环、鼠标中键 360°、移动降级 |
| SOP Digital Passport | 一个版本一个风险身份 | 分数、门禁、证据覆盖、阻断项、警告项 |
| Readiness Gate | 避免不安全 SOP 被误当成可执行流程 | `BLOCK/WARN/READY` |
| 钓鱼演练闭环 | 选择、评分、后果、教练反馈 | `evaluate_decision` |
| 团队 SOP 工作台 | 历史、版本、分享和协作 | SQLite 持久化、版本时间线、安全分享链接 |
| 版本风险漂移 | 找出修改后新增的风险 | 行级变化、分数差、回归标记 |
| 团队训练 | 把演练分配给成员 | 训练任务、到期时间、审计事件 |
| 决策回放 | 复盘用户曾经如何选择 | 有序决策事件 API |
| 模型与成本面板 | 了解调用次数、耗时与估算成本 | 聚合运行指标 |
| 安全 A2MCP | 可被平台可信调用 | Bearer 鉴权、限流、大小限制、Deadline、安全响应头、审计 |
| 国际化与主题 | 面向全球评委和用户 | 10 种语言、深色默认、浅色/跟随系统 |
| 报告导出 | 提交培训与合规证据 | 浏览器打印为 PDF |

## 3. 身份、角色与团队

### 身份认证

- 邮箱 + 密码登录，Node 原生 scrypt 哈希
- HttpOnly Session Cookie，SameSite=Strict，生产模式 Secure
- 登录、登出、当前用户接口完整

### 角色权限 (RBAC)

| 角色 | 权限 |
|---|---|
| Owner | 全部操作、创建邀请、管理成员、修改角色、移除成员 |
| Editor | 读写 SOP、创建训练、生成分享 |
| Viewer | 只读查看，不可修改 |

### 邀请系统

- Owner 可创建一次性邀请（editor / viewer），48 小时有效
- 服务端只保存 token HMAC 摘要，原始 token 不在数据库中
- 接受后自动创建成员并分配 Session
- 支持查看邀请列表、撤销待接受邀请

### 团队管理

- 成员列表与角色展示
- Owner 可修改成员角色（不能降级最后一个 owner）
- Owner 可移除成员（不能移除自己）

### 安全分享

- 为演练报告生成只读分享链接，无需登录即可查看
- 支持设置过期时间（7 天 / 30 天 / 永久）和最大查看次数
- 分享 token 服务端仅保存 HMAC 摘要
- `/r/:token` 只读报告页面，包含共识、决策、评分、护照信息

## 4. API

### 产品 API

- `POST /api/auth/login` — 登录
- `POST /api/auth/logout` — 登出
- `GET /api/auth/me` — 当前用户
- `GET /api/workspace` — 工作区信息
- `GET/POST /api/sops` — SOP 列表与创建
- `GET /api/sops/:id` — 单个 SOP
- `GET/POST /api/sops/:id/versions` — 版本列表与创建
- `GET /api/sops/:id/passport` — 数字护照
- `GET /api/sops/:id/compare?from=1&to=2` — 版本比较
- `GET/POST /api/training` — 训练任务列表与创建
- `POST /api/training/:id/complete` — 完成训练
- `GET /api/rehearsals/:id/replay` — 决策回放
- `GET /api/audit` — 审计事件
- `GET /api/metrics` — 模型与成本指标
- `POST /api/documents/convert` — PDF/DOCX 转 Markdown

### 邀请与成员 API

- `POST /api/invitations` — 创建邀请（仅 Owner）
- `POST /api/invitations/accept` — 接受邀请（公开）
- `GET /api/invitations` — 邀请列表
- `DELETE /api/invitations/:id` — 撤销邀请（仅 Owner）
- `GET /api/members` — 成员列表
- `PATCH /api/members/:id/role` — 修改角色（仅 Owner）
- `DELETE /api/members/:id` — 移除成员（仅 Owner）

### 分享 API

- `POST /api/shares` — 创建分享
- `GET /api/shares/:token` — 获取分享内容（公开，无需登录）
- `GET /api/rehearsals/:id/shares` — 某演练的分享列表
- `DELETE /api/shares/:id` — 删除分享

### 免费 A2MCP

- `POST /a2mcp/review-sop`
- `POST /a2mcp/generate-rehearsal`
- `POST /a2mcp/evaluate-decision`
- `POST /a2mcp/compare-versions`

比赛期间接口直接返回 HTTP 200，不要求 x402。赛后收费只在传输边界增加 OKX Payment SDK
中间件，不修改 Contracts、Core、评分器或 Three.js。

### 标准 MCP（无状态基线）

使用官方 @modelcontextprotocol/sdk，通过 Streamable HTTP 传输：

- `initialize` / `tools/list` / `tools/call`
- `review_sop` / `generate_rehearsal` / `evaluate_decision` / `compare_sop_versions`
- Bearer 鉴权，非法 GET/DELETE 返回 405

## 5. 安全边界

- `SOPSCAPE_API_KEY` 配置后，所有 `/a2mcp/*` 请求必须携带 Bearer Token；
- 默认每 IP 每分钟 120 次请求，可用 `RATE_LIMIT_PER_MINUTE` 调整；
- Fastify body 上限 64 KiB，SOP 内容上限 60 KiB；
- 所有输入先过 Zod Contract，错误不回显密钥或内部堆栈；
- 58 秒绝对 Deadline，并为 HTTP 响应保留 2 秒；
- CSP、`nosniff`、禁止 iframe、无敏感 Referrer、禁用摄像头/麦克风/定位；
- SQLite 开启外键；生产 DB 文件必须置于持久卷并定期备份；
- Session Cookie HttpOnly + SameSite=Strict，生产模式 Secure；
- 邀请 token 仅保存 HMAC 摘要，原始值不入库；
- 不发送真实钓鱼邮件、不采集用户密码；外部邮件平台只能作为未来授权连接器。

## 6. 当前完成度

| 口径 | 完成度 |
|---|---|
| 本地可展示 Demo | ~85% |
| 产品核心功能 | ~75% |
| 前端视觉与交互 | ~82% |
| 身份/RBAC/邀请/分享 | ~90% |
| SOP 工作台 | ~70% |
| 钓鱼训练闭环 | ~70% |
| A2MCP | ~75% |
| 严格"完整 MCP"（有状态） | ~45% |
| 企业级安全与运维 | ~40% |
| 生产部署 | ~20% |

> 项目已经是可本地演示、功能较丰富的 Hackathon 产品原型。
> 生产部署和 OKX.AI 上架仍待完成。

## 7. 两人继续并行开发

- 开发者 A：生产部署、OKX.AI 上架探测、真实模型稳定性、API 安全和数据备份；
- 开发者 B：真实浏览器桌面/移动视觉验证、演示脚本、报告排版和提交材料；
- A/B 不修改同一文件；各自从最新 `origin/main` 创建 Worktree；
- Contracts 变更先单独 PR，前后端随后消费，不在适配器复制类型；
- 每个 PR 运行 `pnpm verify`，另一账号审查后 Squash Merge。

## 8. 演示验收路径

1. 输入"钓鱼邮件处置"SOP；
2. 等待三专家完成，观察 3D 节点与风险路径；
3. 先选择"点击链接"，确认核心变红、扣分并显示凭证泄漏后果；
4. 再选择"独立核验并上报"，确认核心转安全色并加分；
5. 打开"证据档案"，展示门禁分数、阻断项和证据引用；
6. 打开"演练记录"，创建第二版并执行风险比较；
7. 分配团队训练并打开"安全与权限"查看审计记录；
8. 打开"协议接口"展示四个 A2MCP 工具与模型成本；
9. 导出培训报告。
