# SOPscape Council

SOPscape Council 把静态 SOP 转换成可决策、可验证、可分享的 AI 情境演练。

它不是普通的 SOP 总结器，也不是带 3D 背景的聊天机器人。系统让三名职责不同的 AI 专家分别分析流程、风险和证据，再由主持人保留共识、分歧与证据缺口，最终生成结构化报告和可玩的 3D 决策演练。

## 从这里开始

- [项目详细说明](PROJECT_OVERVIEW.zh-CN.md)：项目解决什么问题、如何工作、3D/A2MCP/MCP 的作用和完整用户流程。
- [团队开发规范](CONTRIBUTING.md)：gstack、Git Worktree、分支、Hunk、PR、两人分工、冲突与回退。
- [开发执行与验证手册](.omx/plans/sopscape-council-development-execution-verification.zh-CN.md)
- [产品与技术方案](.omx/plans/prd-sopscape-council.md)
- [测试规范](.omx/plans/test-spec-sopscape-council.md)

## 当前状态

当前仓库处于设计和工程准备阶段，已完成需求、架构、执行计划与测试规范；应用源码尚未开始实现。文档中的性能、协议和上线状态是交付目标，不能当作已经完成的功能。

## 两人分工

- 开发者 A：Contracts、Core、PostgreSQL、Web API、A2MCP、MCP 和部署。
- 开发者 B：React、Three.js、GSAP、六个 UI 组件、决策体验、E2E 与前端性能。

先合并 Contracts 和 Fixture，前后端再通过独立 Worktree 并行开发。任何功能都通过 PR、另一人审查、Hunk 和 CI 后进入 `main`。
