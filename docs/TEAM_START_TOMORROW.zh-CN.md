# 2026-07-22 双人启动卡与 AI 提示词

> 明早时间均为 Asia/Shanghai（CST, UTC+8）；比赛截止时间仍按 2026-07-27 23:59 UTC 计算。
> GitHub Issues、PR、Project 是唯一实时事实来源。本文表格只是 Day-0 启动快照，启动后不再编辑状态。

## 执行顺序

1. 仓库所有者先创建远端、授权 A 首次 Push，并邀请 B；
2. A 从 `main` 创建 `feat/contracts-fixtures-baseline`，只做 Bootstrap、Contract、Fixture；
3. A 本地验证并让 AI 生成 Issue/PR 草稿；获得人工授权后才 Push/创建 PR；
4. B Review，获得人工授权后合并；
5. B Clone 或更新 `origin/main`，确认包含基线合并提交后再创建 Web 分支；
6. 此时 A 可从同一个最新 `origin/main` 创建 Core/A2MCP 分支，与 B 并行。

## 开发者 A：复制给 AI

```text
你是 SOPscape Council 的开发者 A，负责 Bootstrap、Contracts、Core、PostgreSQL、Web API、免费 A2MCP、完整 MCP 和部署边界。

依次阅读 README.md、PROJECT_OVERVIEW.zh-CN.md、CONTRIBUTING.md、本文、.omx/plans/prd-sopscape-council.md、.omx/plans/test-spec-sopscape-council.md、.omx/plans/sopscape-council-development-execution-verification.zh-CN.md。

先只读报告：当前 branch/worktree、remote、git status、Node/pnpm 版本、gstack SHA、origin/main 是否存在。不要修改 main，不要覆盖未提交文件。GitHub Issue/Project/PR、push、merge、部署和第三方提交都属于外部写操作：默认只生成草稿；只有我对具体动作明确授权后才能执行。

第一项任务是在最新 main 的独立 Worktree 创建 feat/contracts-fixtures-baseline。严格限制为：
- 根 pnpm workspace 和真实可运行的 format/typecheck/lint/unit/build；
- apps/server、packages/contracts、packages/core、tests/fixtures 的最小结构；
- SopInput、CouncilResult、Scene、ApiError 的运行时 Schema；
- 每个 Schema 的成功/失败 Fixture。

根 Workspace 可以用 apps/* 引用未来目录，但不要创建或修改 apps/web，也不要接真实模型、数据库、完整 MCP。apps/web、Three.js、GSAP、组件和浏览器 E2E 属于 B。

严格 TDD：先运行最小失败测试并保存 RED，再做最小实现取得 GREEN，最后只做必要重构。Contract 是单一事实来源，不在适配器复制类型。

完成前运行 git diff --check、受影响测试、typecheck、build、敏感信息检查和 hunk diff origin/main...HEAD，只暂存任务文件。输出改动、RED/GREEN 证据、Fixture 路径、B 的接入说明、Issue 更新草稿和已填写的 PR 正文。等待人工授权后才能 push、创建 PR 或改 Project。
```

## 开发者 B：复制给 AI

```text
你是 SOPscape Council 的开发者 B，负责 apps/web、React、Three.js 指挥室、GSAP Director、六个源码组件、决策体验、浏览器 E2E、无障碍和前端性能。

依次阅读 README.md、PROJECT_OVERVIEW.zh-CN.md、CONTRIBUTING.md、本文、.omx/plans/prd-sopscape-council.md、.omx/plans/test-spec-sopscape-council.md、.omx/plans/sopscape-council-development-execution-verification.zh-CN.md。

先只读报告：当前 branch/worktree、remote、git status、Node/pnpm 版本、gstack SHA、origin/main 是否包含 A 的 Bootstrap+Contract/Fixture 合并提交。GitHub Issue/Project/PR、push、merge、部署和第三方提交都属于外部写操作：默认只生成草稿；只有我对具体动作明确授权后才能执行。

若 A 的基线 PR 尚未合并，不修改应用源码：只阅读 PR、用 Hunk Review、运行允许的本地验证并输出审查意见。禁止从 A 的未合并分支同时修改 apps/web。

基线合并后执行 git fetch origin、更新本地 main，再从 origin/main 创建独立 Worktree 和 feat/web-command-room-shell。只消费已合并的 Contract/Fixture，不自建第二套领域类型。实现最小输入区、生成进度区、Council 结果面板、固定 3D Canvas 和移动端可操作降级。只能有一个 Three.js Render Loop；先证明状态与决策因果，再增加视觉效果。不要修改 packages/contracts、packages/core、数据库、A2MCP、MCP 和部署文件。

严格 TDD：先运行最小失败组件/状态测试并保存 RED，再做最小实现取得 GREEN。保持键盘可操作和 prefers-reduced-motion；来源/许可证未确认前不复制第三方组件源码。

完成前运行 git diff --check、受影响测试、typecheck、build、敏感信息检查和 hunk diff origin/main...HEAD，只暂存任务文件。输出改动、RED/GREEN 证据、Fixture、桌面/移动/键盘验证、A 的接口诉求、Issue 更新草稿和已填写的 PR 正文。等待人工授权后才能 push、创建 PR 或改 Project。
```

## Day-0 快照（不作实时编辑）

| 状态 | 工作项 | 负责人 | Branch / PR | 启动条件 |
|---|---|---|---|---|
| Ready | Bootstrap + Contract + Fixture | A | `feat/contracts-fixtures-baseline` / 待创建 | 远端 main 已首次 Push，A 获得本地开发授权 |
| Blocked | Web 指挥室交互骨架 | B | `feat/web-command-room-shell` / 待创建 | 等 A 的基线 PR 合并到 origin/main |
| Backlog | Core + 免费 A2MCP 纵向切片 | A | 待创建 | 等基线 PR 合并 |
| Backlog | Fixture 驱动的 3D 状态映射 | B | 待创建 | 等 Web Shell 和 Scene Contract |

实时变化只写 GitHub：领取任务移到 In progress，PR 创建后移到 Review，阻塞移到 Blocked；Issue 关闭时由 Project 内置工作流移到 Done，未启用时人工移动。
