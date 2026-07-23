# SOPscape Council — OKX.AI 与 Hackathon 提交材料包

## 1. 一句话介绍

SOPscape Council 将静态操作流程转换为由多代理共同审查、可评分、可复盘的 3D 风险决策演练。

## 2. ASP 名称

```text
SOPscape Council
```

## 3. ASP 类型与价格

```text
类型：A2MCP
价格：0
模式：Hackathon 期间免费
```

## 4. Endpoint

```text
POST https://sopscape-production.up.railway.app/a2mcp/generate-rehearsal
Content-Type: application/json
```

## 5. 短描述

```text
把 SOP 转换为多代理风险审查和结构化决策演练，输出共识、分歧、证据缺口、建议路径及可玩的决策节点。
```

## 6. 完整描述

```text
团队通常把 SOP 存放在文档里，但静态文档无法证明员工是否真正理解风险，也很难暴露流程中的证据缺口。

SOPscape Council 接收一段 SOP，由流程分析、风险控制和证据审查三名 AI 专家并行分析，再由主持人保留它们的共识、分歧和证据缺口。服务返回结构化决策节点，Web 应用将结果呈现为可交互的 3D 指挥室，并支持选择、评分、复盘、培训报告、版本比较和安全分享。

首个完整场景是钓鱼邮件处置，但同一结构也适用于事件响应、审批流程、客户支持、合规检查和团队培训。
```

## 7. 解决的现实问题

- 静态 SOP 难以验证理解程度
- 风险步骤和证据缺口不直观
- 培训结果缺少评分和复盘
- 流程版本变化缺少风险比较
- 多个 AI 意见容易被压缩成单一答案

## 8. 核心差异

- 三个专业代理并行分析，而不是单模型总结
- 明确保留共识、分歧和证据缺口
- 输出严格结构化，可被 Agent 或 API 直接调用
- 同一结果同时驱动 A2MCP、MCP、报告和 3D 演练
- 可用于加密和非加密行业

## 9. 示例输入

```json
{
  "title": "钓鱼邮件处置流程",
  "content": "员工收到要求紧急付款的邮件时，不得点击邮件链接，应通过独立渠道核验发件人，保留邮件证据并上报安全团队。",
  "locale": "zh-CN"
}
```

## 10. 示例输出摘要

```text
共识：不得直接点击；必须独立核验；需要保留证据并上报。
分歧：立即隔离设备还是先确认是否发生点击。
证据缺口：缺少上报 SLA、责任人和升级路径。
决策节点：忽略、直接执行、独立核验、隔离、上报。
```

## 11. 创意天才赛道陈述

```text
多数 AI 工具把流程压缩成一段更短的文字。SOPscape Council 做相反的事：它让多个 AI 的共识、分歧和未知信息变成一个可以进入、旋转、选择和复盘的 3D 决策空间。用户不是阅读答案，而是在风险发生前练习做决定。
```

## 12. 90 秒演示脚本

### 0–12 秒：问题

```text
传统 SOP 只是文档。团队无法确认员工是否真正理解，也看不到流程中的风险和证据缺口。
```

### 12–28 秒：调用 ASP

```text
这是 SOPscape Council。输入一段钓鱼邮件处置 SOP，三名 AI 专家同时从流程、风险和证据角度进行审查。
```

### 28–48 秒：展示 Council

```text
系统不会把意见强行合并，而是保留共识、分歧和缺失证据，并给出可验证的建议路径。
```

### 48–70 秒：3D 演练

```text
这些结构化结果会进入 3D 指挥室。用户旋转视角、选择行动，风险路径、核心状态和评分实时变化。
```

### 70–84 秒：产品闭环

```text
团队还可以管理 SOP 版本、分配训练、查看复盘报告，并通过安全只读链接分享结果。
```

### 84–90 秒：结尾

```text
SOPscape Council：不要只阅读流程，在风险发生前练习决策。
```

## 13. X 帖子草稿

```text
We built SOPscape Council for the OKX.AI Genesis Hackathon.

It turns static SOPs into multi-agent risk reviews and playable 3D decision rehearsals.

Three specialist agents preserve consensus, disagreements and evidence gaps — then users practice decisions, receive scores and review the consequences.

ASP: [OKX.AI listing URL]
Demo: https://sopscape-production.up.railway.app

#OKXAI
```

发布时附上不超过 90 秒的视频或清晰流程演示。

## 14. Google Form 草稿

```text
Project name: SOPscape Council
Category: Creative Genius
ASP type: A2MCP
ASP price: Free / 0
Demo URL: https://sopscape-production.up.railway.app
Endpoint: https://sopscape-production.up.railway.app/a2mcp/generate-rehearsal
OKX.AI listing URL: [审核通过后填写]
X post URL: [发布后填写]
GitHub URL: https://github.com/MilchstraBe-Endless10/OKX-AI-Hackathon
```

## 15. 最终提交门槛

- [ ] 修复后的完整产品后端已重新部署
- [ ] `pnpm verify:listing` 全绿
- [ ] 真实浏览器登录、邀请、分享、演练通过
- [ ] ASP 注册成功
- [ ] OKX.AI 审核通过并上线
- [ ] 90 秒视频完成
- [ ] X 帖子包含 `#OKXAI`
- [ ] Google Form 在 2026-07-27 23:59 UTC 前提交
- [ ] 保存所有回执和链接

北京时间截止时间为 2026-07-28 07:59。
