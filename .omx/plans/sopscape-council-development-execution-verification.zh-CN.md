# SOPscape Council 中文开发执行与验证手册

> 状态：可执行开发手册，受已批准 PRD 与测试规范约束。
> 编制日期：2026-07-21。比赛截止时间：2026-07-27 23:59 UTC。
> 上位文档：`.omx/plans/prd-sopscape-council.md`。
> 验证基线：`.omx/plans/test-spec-sopscape-council.md`。
> 当前事实：仓库尚无应用源码、依赖清单、数据库迁移或测试工程；本文中的路径和命令需要在初始化工程后落地。

## 1. 文档目的

本文用于指导团队在比赛截止前完成 SOPscape Council 的开发、集成、部署和验证，回答四个问题：

1. 每个阶段先做什么、后做什么；
2. Core、A2MCP、MCP、Web/3D 和验证工作如何分工；
3. 每项功能用什么检查证明完成；
4. 什么条件下可以进入下一阶段或宣布内部交付完成。

本文不替代 PRD。发生冲突时，按以下优先级执行：用户确认的 `no-fallback` 约束 → PRD → 测试规范 → 本手册。

## 2. 最终交付目标

必须同时交付：

- 一个公开 HTTPS 的免费 OKX.AI A2MCP 服务；成功请求直接返回 HTTP 200，比赛版本不包含 x402；
- 一个符合当前正式规范的完整 MCP Streamable HTTP 服务，路径为 `/mcp`；
- 一个固定全息指挥室风格的 Web 体验；
- 三名专家并行分析、一名主持人综合的完整生成链路；
- 可玩的钓鱼邮件 SOP 演练，用户决策会改变数据状态与 3D 表现；
- 三个 React Bits 和三个 21st.dev 源码组件；
- 桌面端接近 60 FPS、移动端降质但功能完整；
- 完整测试、性能、安全、许可证和发布证据；
- 不超过 90 秒且所有表述均有证据支持的演示材料。

禁止用以下内容代替正式范围：

- 只有工具调用、没有 resources/prompts/progress/session 的“薄 MCP”；
- 少于三名成功专家就进入主持阶段；
- 只改变颜色、不改变结果状态的装饰性选择；
- 少于六个已审核组件；
- 比赛期间启用收费或 PAYMENT-REQUIRED/x402；
- 用静态假数据冒充已经完成的真实生成链路。

## 3. 技术基线与工程边界

### 3.1 推荐工程结构

```text
apps/
  web/                 React、Tailwind、Three.js、GSAP
  server/              Fastify、Web API、A2MCP、MCP、数据库入口
packages/
  contracts/           Zod Schema、DTO、JSON Schema
  core/                编排、生命周期、预算、投影、决策与持久化接口
tests/
  fixtures/
  unit/
  integration/
  security/
  e2e/
  performance/
docs/
  privacy-retention.md
  operations.md
  component-provenance.md
  payment-extension.md
artifacts/              本地验证证据，按日期或提交 SHA 分目录
```

### 3.2 单一事实来源

- `packages/contracts` 定义运行时 Schema，并从 Schema 派生 TypeScript 类型和 JSON Schema；禁止为三个适配器手写三份领域类型。
- `packages/core` 独占 SOP 解析、模型调用、专家编排、主持综合、验证、持久化和决策计算。
- Web、A2MCP 和 MCP 只能负责鉴权、传输映射、错误映射和投影选择。
- PostgreSQL 不保存原始 SOP、Prompt、模型原始响应、思维链、原始能力令牌、原始 MCP Session ID、密钥或 IP。
- Three.js 独占唯一 `renderer.setAnimationLoop`；GSAP 负责全局动画时序；React 只保存粗粒度界面状态。

### 3.3 最小依赖原则

仅引入已在 PRD 中通过用途审查的依赖。不要增加 ORM、队列、事件总线、第二个 3D 引擎或第二个全局动画系统。正式安装前必须：

1. 核对 Node LTS 与部署平台兼容性；
2. 在开始 MCP 实现前 24 小时重新检查官方 TypeScript SDK 状态；若 v2 仍为预发布，固定生产推荐的 v1.x；
3. 只选择一个支持结构化输出、超时和 AbortSignal 的模型提供商 SDK；
4. 固定 lockfile，并记录六个组件的来源、作者、许可证、哈希和依赖。

## 4. 团队分工与共享文件规则

建议四条并行工作线：

| 工作线 | 主要责任 | 独占写入范围 | 首要验收 |
|---|---|---|---|
| Core/A2MCP | Schema、生命周期、模型编排、数据库、免费 A2MCP、部署 | `packages/contracts`、`packages/core`、Server 的 API/A2MCP | 注册 Fixture、HTTP 200、58 秒绝对期限 |
| MCP | `/mcp`、会话、工具、资源、提示词、进度和取消 | `apps/server/src/mcp` | Inspector/客户端完整流程 |
| Web/3D | 页面、六组件、指挥室、GSAP、决策因果、无障碍 | `apps/web` | 桌面完整演练与移动端操作 |
| 验证 | Fixture、跨适配器、E2E、性能、安全、证据 | `tests/e2e`、验证脚本和 `artifacts` | 独立验证结果，不接受口头完成 |

共享规则：

- Contract 由 Core 工作线维护；修改前先更新 Schema 测试，再通知其他工作线同步。
- 不允许两个工作线同时修改同一个文件。
- 验证工作线只提交测试、证据或缺陷，不直接重写其他工作线的大段实现。
- 外部提交、发布 X 帖子、上线收费、变更第三方资源必须获得用户明确批准。

## 5. 开发方法

每个非平凡功能执行同一个短循环：

1. **定义可观察结果**：明确输入、输出、错误、指标和安全边界；
2. **RED**：先写一个能证明该结果的最小失败测试；
3. **GREEN**：只写使测试通过的最小实现；
4. **REFACTOR**：删除重复，保持 Core 与适配器边界；
5. **局部验证**：运行受影响的测试和类型检查；
6. **集成验证**：合并前运行该工作线完整测试层；
7. **记录证据**：保存命令、提交 SHA、结果、环境和失败说明。

不得为了赶进度删除输入验证、授权、超时、资源上限、无障碍或清理逻辑。

## 6. 七天开发执行计划

日期按 UTC。若实际开始时间发生变化，保持阶段依赖不变。

### Day 1：外部契约冻结与工程初始化（7/21）

**开发任务**

- 冻结 OKX.AI 注册 Manifest、请求 Schema、成功与错误 Fixture；
- 核实免费服务的直接 HTTP 200 形态；
- 固定 MCP 正式规范和 SDK 版本；
- 确定部署平台、PostgreSQL、模型提供商、桌面基准机和移动测试机；
- 确定三项 React Bits 与三项 21st.dev 组件；
- 初始化 pnpm workspace、TypeScript、格式化、Lint、Vitest、Playwright 和环境变量示例；
- 建立 CI 的空流水线，确保基础工程可以安装、构建和运行测试。

**必须产生的证据**

- 版本与来源清单；
- 六组件许可证/哈希/依赖台账；
- 本地与部署环境的 Node 版本结果；
- 空工程的 build/typecheck/test 结果；
- OKX Fixture 的冻结副本。

**退出条件**

- 不存在部署、凭据、SDK、许可证或测试设备阻塞；
- CI 可以从干净环境完成安装和空构建。

### Day 2：Schema、Core 与 A2MCP 纵向切片（7/22）

**开发顺序**

1. `SopInput`、专家输出、主持输出、Scene、Decision、外部投影和 `ApiError` Schema；
2. 生命周期状态机、AttemptBudget、绝对 Deadline 和幂等规则；
3. 一次数据库迁移及参数化 `pg` 访问；
4. Fixture 驱动的“三专家并行 → 全部成功 → 主持综合”；
5. A2MCP 路由、输入验证、错误映射、58 秒绝对期限；
6. 接入一个真实模型提供商，保持确定性 Fixture 为 CI 主基线；
7. 部署公开 HTTPS 纵向切片并执行冷启动检查。

**退出条件**

- 三名专家确实并行启动，主持人只在三份合法结果齐备后启动；
- 最大尝试预算为 9 次调用、12,400 个预留输出 Token；
- A2MCP 成功返回注册 Schema 的 HTTP 200；
- 失败不会返回伪成功或异步 Job URL；
- 比赛构建不存在 x402 依赖或支付响应头；
- 公开端点具备可归档的 Smoke 结果。

### Day 3：完整 MCP 与首轮 ASP 准备（7/23）

**开发任务**

- 在同一 Fastify 服务的 `/mcp` 挂载 Streamable HTTP；
- 实现 POST/GET/DELETE、Origin、协议版本和 Content Negotiation；
- 实现 256-bit Session ID、哈希存储、启动实例绑定和 TTL；
- 实现三个 Tools：`generate_rehearsal`、`get_rehearsal`、`evaluate_decision`；
- 实现 Scene/Report Resources、Examples Resource 与三个 Prompts；
- 实现 `_meta.progressToken`、单调进度、取消和终止后静默；
- 形成 ASP 审核准备包，但未经用户批准不执行外部提交。

**退出条件**

- 官方 Inspector 或兼容客户端完成初始化、生成/进度、资源读取、决策、报告和 DELETE；
- 旧启动实例、过期、未知或已删除 Session 返回预期错误；
- Tools/Resources/Prompts/Progress 均由能力声明公开；
- 内部审核准备包在 2026-07-23 12:00 UTC 前完成。

### Day 4：3D 指挥室和真实进度驱动（7/24）

**开发顺序**

1. 先让页面和 DOM 表单在没有 3D 时也能完成基本提交与读结果；
2. 创建固定指挥室、三名专家席位、主持席位、证据节点和风险路径；
3. 建立唯一 `SceneAdapter.apply(readonlySnapshot)`；
4. 建立唯一 Three.js Render Loop 和统一资源 Dispose；
5. 用 GSAP 编排相机、Agent 到场、阶段变化和结果揭示；
6. 接入六个已审核组件，每个占用不同职责槽位；
7. 绑定真实 Core 状态，禁止用独立计时器伪造 Agent 进度；
8. 加入 reduced-motion、键盘操作和状态播报。

**退出条件**

- Shell 在模型完成前可操作，目标中位数不超过 2 秒；
- Three.js 只有一个 RAF/`setAnimationLoop`；
- GSAP Timeline 在组件卸载时完整清理；
- 隐藏页面后 250ms 内暂停动画和组件效果；
- 六组件台账、来源与许可证通知完整。

### Day 5：决策因果、报告与分享（7/25）

**开发任务**

- 完成钓鱼邮件演练的决策节点和后果；
- 每次选择同时更新版本、置信度、图拓扑、颜色语义、镜头、后果文本和下一步；
- 使用 `expectedVersion` 做乐观并发控制；
- 实现一次性 Owner Capability、只存哈希、Bearer 鉴权；
- 实现独立只读 Share Capability、创建、访问、撤销和过期；
- 完成共识、分歧、证据缺口和报告视图；
- 使用两个额外 Schema Fixture 验证 SceneAdapter 可复用，但不增加第二套 3D 世界。

**退出条件**

- 无刷新完成提交、进度、选择、3D 后果、报告和分享；
- UUID 本身不具有任何读取或修改权限；
- Share Token 无法决策、取消或创建分享；
- 并发旧版本写入返回 `VERSION_CONFLICT`。

### Day 6：集成加固与审核修复（7/26）

**执行顺序**

1. Unit/覆盖率；
2. PostgreSQL/模型/并发 Integration；
3. A2MCP 注册 Fixture 和 58 秒 Deadline；
4. MCP 协议与重启会话；
5. Security；
6. Chrome、移动端、键盘和 reduced-motion E2E；
7. 生成时延、FPS、内存释放、过载和冷启动；
8. 修复审核反馈并重新执行受影响层和完整上层验证。

**退出条件**

- 四个命名范围的 lines/branches/functions/statements 均不低于 80%；
- 零已知 Critical/High 安全缺陷；
- 所有资源和并发上限均以有界错误失败；
- ASP 修复包已准备；外部重新提交仍需用户批准。

### Day 7：发布候选与提交材料（7/27）

**开发冻结**

- 只接受阻塞发布的修复，不再新增功能或依赖；
- 固定 Schema、依赖、部署配置和 Fixture 哈希；
- 冷、热环境各执行一遍完整验证；
- 制作不超过 90 秒的演示脚本与录屏；
- 逐条核对演示中的每项陈述是否有测试或线上证据；
- 监控 A2MCP、MCP、Share URL、数据库和模型路径。

**最终退出条件**

- 本文第 12 节“内部完成定义”全部满足；
- 外部 OKX.AI 已提交/批准/上线只能由官方回执证明；
- 未获得用户明确批准时，只交付本地提交包，不进行发布、发帖或外部提交。

## 7. 关键模块开发规范

### 7.1 Core 编排

- 输入先经过 Zod 校验、UTF-8 字节限制和输入 Token 预算准入；
- 需要压缩时只允许一次 1,200 Token 尝试，不重试；
- 三名专家各最多两次尝试，每次上限 1,200 Token；
- 主持人最多两次尝试，每次上限 2,000 Token；
- 任何已开始的失败、取消、格式错误或超时尝试都扣除完整配额；
- Schema 修复就是该角色唯一一次重试，禁止隐藏的第三次调用；
- 任一专家最终失败，整个任务失败，不进入部分主持；
- 终态写入后，迟到的 Provider 结果必须被版本/终态检查丢弃。

### 7.2 A2MCP

- 最早可信入口建立 58.0 秒绝对单调时钟 Deadline；
- Deadline 覆盖校验、排队、模型、持久化、投影和序列化，不允许阶段重置；
- 始终保留 2 秒错误序列化窗口；
- 上游代理必须证明超时不少于 65 秒；
- 成功严格返回注册结果 Schema；超时在 58 秒前完成固定 504；
- 免费版本扫描结果中不得出现支付中间件、PAYMENT-REQUIRED 或 x402 分支。

### 7.3 MCP

- 只使用 `/mcp` 的 Streamable HTTP，不增加旧 HTTP+SSE 端点；
- 初始化时协商协议版本并创建随机 Session；后续请求同时验证 Session 和版本；
- Session 只存哈希并绑定内存中的 `serverInstanceId`；每次启动先清理旧会话；
- 每 Session 最多保留 10 个 rehearsal 引用和 32 KiB 状态；
- 空闲 30 分钟、绝对 2 小时过期；重启后绝不恢复；
- 没有 progressToken 时不发进度；有 Token 时原样回显；终态后不再发送通知；
- DELETE 关闭 Stream、取消该 Session 拥有的请求并返回 204。

### 7.4 Web 权限

- 创建 Job、幂等记录和 Owner Capability 哈希必须在一个事务内提交；
- Owner Capability 为一次性 256-bit 随机值，只在首次响应体出现；
- Share Capability 为独立 192-bit 随机值，只读、可撤销、只存哈希；
- 原始 Capability 不进入 URL、日志、Metric、Trace 或数据库；
- UUID 只能标识资源，不能授权；
- Owner 和 Share 投影使用不同 Schema，并用快照测试阻止私有字段泄漏。

### 7.5 3D、GSAP 与组件

- `SceneAdapter` 只接受冻结、已验证的快照；不修改领域对象；
- React 不在每帧调用 `setState`；Three 对象和 Uniform 由 Adapter 命令式更新；
- 桌面 DPR 最大 1.75，移动端最大 1.25；
- 指挥室预算：最多 150 Draw Calls、250k 可见三角形、64 MiB 纹理估算；
- 桌面最多两个后处理 Pass，移动端零或一个；
- 五次 Reset/Unmount 后，`renderer.info` 资源量回到 Shell 基线的 5% 范围；
- 外部组件不得创建 WebGL、永久 RAF、全局 Timeline 或引入 Framer Motion；不合格时只能在同一职责槽内替换。

## 8. 环境与配置检查

实现工程初始化后，至少提供以下环境变量；真实值只放部署 Secret 管理器或未提交的本地环境：

```text
NODE_ENV
PORT
DATABASE_URL
MODEL_API_KEY
MODEL_NAME
PUBLIC_APP_ORIGIN
TRUSTED_PROXY_CIDR
PROVIDER_DAILY_SPEND_USD
```

启动时必须：

- 使用 Schema 校验配置，缺少必需项时快速失败；
- 输出安全的配置摘要，禁止输出 Secret、数据库密码或完整 URL 凭据；
- 执行数据库迁移检查；
- 生成新的 `serverInstanceId`；
- 清理 MCP Session，并把未完成 Job 终态化为 `SERVER_RESTART`；
- 完成上述步骤前 Readiness 保持失败。

## 9. 标准开发命令

以下脚本名应在根 `package.json` 初始化时统一，避免各工作线自行发明命令：

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test:unit
pnpm test:integration
pnpm test:a2mcp
pnpm test:mcp
pnpm test:security
pnpm test:e2e
pnpm test:performance
pnpm test:coverage
pnpm build
```

建议聚合命令：

```bash
# 合并请求的最小完整门槛
pnpm verify

# 发布候选的完整门槛
pnpm verify:release
```

`verify` 应按以下顺序运行：格式 → 类型 → Lint → Unit/覆盖率 → Integration → A2MCP/MCP → Security → Build。
`verify:release` 在 `verify` 后继续运行 E2E、无障碍、Provider Sandbox、性能、过载、冷启动与证据审计。

若某脚本尚未实现，不得用空脚本返回成功；应让命令明确失败并列出缺失门槛。

## 10. 分层验证流程

### 10.1 Unit

重点证明：

- 所有 Schema 的合法/非法边界；
- 生命周期只允许合法迁移；
- AttemptBudget 的 9 次/12,400 Token 上限；
- 幂等冲突、投影隔离和版本冲突；
- SceneAdapter 不修改输入；
- reduced-motion 与桌面/移动质量配置。

失败处理：只修实现或错误的需求假设；不得为了让测试通过而放宽安全边界。

### 10.2 Integration

必须使用真实测试 PostgreSQL，验证：

- Job、幂等和 Capability 事务原子性；
- 决策并发、过期删除、重启恢复和资源池上限；
- 三个适配器调用同一 Core 且领域含义一致；
- Provider 超时、截断、恶意注入、非法结构和断路器；
- A2MCP 单一绝对 Deadline；
- MCP Session、Progress、Cancel、Restart 和流上限。

### 10.3 Security

至少覆盖：

- Capability/IDOR、撤销、过期、跨 rehearsal 和时序枚举；
- Stored XSS、Prompt Injection、SSRF、CORS、CSP、代理头伪造；
- 参数化 SQL、Secret Scan、客户端 Bundle Scan；
- 依赖漏洞、Lockfile 完整性、六组件许可证和内容哈希；
- 日志、数据库和 Trace 中不存在原始 SOP、Prompt、Provider Payload、Capability、Session 或 Secret。

### 10.4 E2E 与无障碍

桌面 Chrome 必须无刷新完成：

```text
提交 15k 钓鱼 SOP
→ 2 秒左右出现可交互 Shell
→ 看见三名专家真实阶段
→ 看见共识/分歧/证据缺口
→ 做出决策
→ 数据与 3D 同时产生后果
→ 查看报告
→ 创建、访问并撤销只读分享
```

同时验证键盘全流程、可见焦点、语义标签、状态播报、对比度、reduced-motion，以及指定移动设备上的完整操作。

### 10.5 性能

| 项目 | 门槛 | 采样方式 |
|---|---:|---|
| 桌面 Shell 可交互 | 中位数 ≤2.0s，最差 ≤2.5s | 生产构建、禁缓存、5 次冷导航 |
| 桌面帧率 | 中位数 ≥55 FPS，1% Low ≥45 | 主流程 30 秒 Trace |
| 移动帧率 | 中位数 ≥45 FPS，1% Low ≥35 | 指定设备 30 秒 Trace |
| 模型生成 | 中位数 ≤20s，p95 ≤45s，终态 ≤60s | 20 次，含 5 次 15k 中文输入 |
| 资源释放 | 五轮后距 Shell 基线 ≤5% | `renderer.info` 与 Heap Snapshot |
| 过载 | Queue/Pool 不超限，事件循环 p95 ≤100ms | 10 分钟 Soak |
| MCP 对 A2MCP 影响 | A2MCP p95 恶化 ≤20% | 同机并发 Soak |

性能失败先检查重复 Render Loop、React 每帧状态、未暂停组件、DPR、阴影、后处理和资源泄漏。允许降低 GPU 实现复杂度，但不能删除因果动画、六组件或完整交互。

### 10.6 部署与冷启动

连续五次从冷部署状态验证：

- `/health/live` 只反映进程；
- `/health/ready` 正确反映迁移、数据库和接单状态；
- 免费 A2MCP 可完成真实请求；
- `/mcp` 能完成初始化与工具调用；
- Share URL 可打开且权限正确；
- 数据库和模型路径可用；
- 日志与错误响应不泄漏敏感信息。

## 11. 证据归档规范

每次发布候选创建一个目录：

```text
artifacts/<UTC-date>-<git-sha>/
  environment.json
  commands.log
  coverage/
  a2mcp/
  mcp/
  security/
  e2e/
  accessibility/
  performance/
  deployment/
  licenses/
  demo/
  summary.md
```

`summary.md` 至少记录：

- Git SHA、Node/pnpm/浏览器/设备/SDK/模型版本；
- 执行命令和退出码；
- 每项门槛的实测值；
- 失败项、修复提交和复测结果；
- 未执行项及原因；
- OKX 外部回执状态，且与内部测试状态分开。

归档前先脱敏，不保存 SOP 原文、Prompt、Provider 原始响应、Token、Capability、Session、密钥或完整 IP。

## 12. 内部完成定义

只有同时满足以下条件，才可声明“内部开发完成”：

- Web、免费 A2MCP 和完整 MCP 均调用同一 Core；
- 三专家并行、主持综合、15k 输入、决策因果和分享流程均工作；
- 三个 React Bits 与三个 21st.dev 组件通过来源、许可证、依赖和无障碍审核；
- Unit、Integration、A2MCP、MCP、Security、E2E、Accessibility、Build 全部通过；
- 四个命名范围的四项覆盖率指标均 ≥80%；
- 桌面、移动、生成、资源释放、过载和冷启动性能门槛通过；
- 零已知 Critical/High 缺陷；
- 比赛部署中不存在支付/x402 行为；
- 最终证据包完整且已脱敏；
- 演示不超过 90 秒且没有无法证明的表述。

以下状态必须单独报告，不能由测试推断：

- ASP 是否已提交；
- OKX.AI 是否已审核；
- ASP 是否已批准或上线；
- X 帖子和 Google 表单是否已发布/提交。

这些外部动作只有在用户明确批准并取得官方回执后，才能标记完成。

## 13. 失败处置与回归规则

验证失败时：

1. 保存失败命令、日志、Fixture、环境和复现步骤；
2. 将问题分配给拥有该文件范围的工作线；
3. 先运行最小复现测试；
4. 修复根因，不在每个调用方重复打补丁；
5. 运行最小失败测试；
6. 运行受影响的完整测试层；
7. 若修改 Contract、数据库、权限、Deadline 或动画所有权，再运行所有下游层；
8. 更新证据摘要，保留失败和修复历史。

不得通过跳过测试、扩大超时、取消安全检查、减少 Agent/组件/MCP 能力或伪造测试数据关闭缺陷。

## 14. 每日站会模板

```text
日期/UTC：
当前 Git SHA：

已完成：
- 功能：
- 验证命令与结果：
- 证据路径：

进行中：
- 工作项 / 负责人 / 预计完成时间：

阻塞：
- 阻塞内容：
- 对关键路径的影响：
- 可执行的解除动作：

风险：
- A2MCP 审核：
- MCP 协议：
- 模型延迟/预算：
- 3D 性能：
- 安全/隐私：

下一检查点：
- 必须通过的退出条件：
```

## 15. 发布前最终检查清单

- [ ] 依赖与 Schema 已冻结，Lockfile 无漂移；
- [ ] 免费 A2MCP 的线上 Fixture 和 58 秒测试通过；
- [ ] `/mcp` Inspector/兼容客户端完整流程通过；
- [ ] Owner/Share Capability 与重启 Session 安全测试通过；
- [ ] 15k 钓鱼邮件全流程 E2E 通过；
- [ ] 六组件来源、许可证、哈希、依赖和无障碍台账完整；
- [ ] 桌面、移动、生成、内存、过载、冷启动报告通过；
- [ ] 覆盖率四项指标均达到 80%；
- [ ] Secret、依赖、CSP/CORS/XSS/SSRF/IDOR 扫描通过；
- [ ] 日志、数据库、Bundle 和证据包完成脱敏检查；
- [ ] 五次冷部署检查通过；
- [ ] 90 秒演示内容与验证证据逐条对应；
- [ ] 外部提交动作已获得用户明确批准；
- [ ] OKX.AI 回执与内部验证结果分开记录；
- [ ] 比赛部署没有付款中间件、402 或 x402 依赖。
