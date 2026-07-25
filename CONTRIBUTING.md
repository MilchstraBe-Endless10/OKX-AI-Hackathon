# SOPscape Council 贡献指南

本项目由两名开发者并行维护。`main` 只用于集成；每个任务使用独立 Branch 和 Worktree，经另一名开发者 Review、Hunk 与 CI 后 Squash Merge。

## 1. 本机准备

两名开发者使用同一台 Ubuntu 电脑的不同 Linux 账号。gstack、SSH Key、GitHub CLI 和 Worktree 均按用户隔离，不共享 `$HOME`、Token 或未提交目录。

```bash
git clone --single-branch --depth 1 \
  https://github.com/garrytan/gstack.git \
  ~/.claude/skills/gstack
cd ~/.claude/skills/gstack
./setup --team
git pull --ff-only
```

Hunk 是本地 Diff Review 工具，不是应用依赖：

```bash
npm install -g hunkdiff
hunk --version
hunk diff origin/feat/integration...HEAD
```

每个 Linux 用户使用自己的 GitHub 身份：

```bash
gh auth login --git-protocol ssh --web
gh auth status
```

不要共享 GitHub Token。除非明确执行仓库自动化、分支保护或 CI 配置，否则不需要 GitHub API 权限。

## 2. 当前分支基线

当前团队集成基线为：

```text
origin/feat/integration @ 2c72e73
PR #7 已合并：前端失败态、无障碍与浏览器验收证据
```

生产验证分支 `feat/prod-verification` 只包含验证脚本和证据，必须经过 Review 后合并到 Release Candidate；不能直接把未审查的验证分支部署到生产。

## 3. 文件所有权

| 负责人 | 主要范围 |
|---|---|
| A | `packages/contracts`、`packages/core`、`apps/server`、数据库、A2MCP、MCP、部署、生产验证 |
| B | `apps/web`、Three.js/GSAP、交互、无障碍、浏览器 E2E、前端性能 |
| 共享 | 根配置、CI、文档；先在 Issue 中标明负责人，避免同时改同一文件 |

Contract 是唯一事实来源。B 不在前端复制领域类型；A 不在后端复制 UI 状态。跨所有权修改必须在 PR 描述中说明并请求对方 Review。

## 4. Branch 与 Worktree

```bash
git fetch origin --prune
git worktree add ../OKX_AI_Hackathon-wt/my-task \
  -b feat/<scope> origin/feat/integration
cd ../OKX_AI_Hackathon-wt/my-task
```

分支命名：`feat/<scope>`、`fix/<scope>`、`test/<scope>`、`docs/<scope>`、`chore/<scope>`。一个分支只处理一个可独立 Review 的目标；同一 Branch 不能同时 Checkout 到两个 Worktree。

PR 合并后清理：

```bash
git worktree remove ../OKX_AI_Hackathon-wt/my-task
git worktree prune
```

## 5. 日常开发流程

1. 从 PRD 或验收缺口创建 GitHub Issue，写清用户价值、范围外、负责人、依赖和验收条件；
2. 从最新 `origin/feat/integration` 创建 Branch/Worktree；
3. 先写最小失败测试或固定 Fixture，再实现最小代码；
4. 只修改任务范围内的文件，不覆盖他人未提交修改；
5. 本地运行受影响测试、类型检查、Lint、Build 和 `hunk diff`；
6. Push 后创建 PR，填写真实验证证据、风险、回退方式和 `Closes #<issue>`；
7. 另一名开发者 Review、运行 CI、解决 Thread；
8. Squash Merge 后从新的集成基线开始下一项工作。

标准验证命令：

```bash
pnpm format:check
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm verify
hunk diff origin/feat/integration...HEAD
git diff --check
```

Web 测试资源紧张时可使用单 worker，但必须在 PR 中记录：

```bash
pnpm --filter @sopscape/web test -- --run --maxWorkers=1 --minWorkers=1
```

## 6. PR Review 清单

- [ ] 改动范围符合文件所有权；
- [ ] 没有复制 Contract、Provider 或第二个 Three.js Render Loop；
- [ ] 输入边界、认证、权限、限流和错误响应没有被绕过；
- [ ] `PARTIAL_FAILED` 不会渲染成 READY 或 HTTP 200 完整结果；
- [ ] 没有提交 API Key、密码、Session Secret、Prompt 或生产数据；
- [ ] 键盘操作、对话框名称、`aria-live`、reduced-motion 和移动端降级得到验证；
- [ ] 测试、类型、Lint、Build、Hunk 和 CI 证据真实可复现；
- [ ] PR 写明未测试项和回退方式；
- [ ] 至少一名另一开发者 Approval，Review Thread 全部解决。

Commit 首行使用 Conventional Commit；正文保留约束、拒绝方案、风险、指令和真实验证证据。

## 7. 并行开发规则

A 与 B 可以并行，但必须从同一已合并基线开始：

```text
Contracts/Fixture 已合并
├── A：Core / A2MCP / MCP / 生产验证
└── B：Web / 3D / 无障碍 / 浏览器验收
        ↓
    Cross-adapter/E2E
        ↓
    Release Candidate
```

如果某个 PR 修改了另一条车道的文件，先在 Issue/PR 中协调，不要在未沟通时强行解决冲突。

## 8. Release Candidate 门槛

Release Candidate 必须从最新 `origin/feat/integration` 创建，并在 Railway 重新部署后记录对应 Git SHA。发布前至少完成：

- `/health/live` 与 `/health/ready`；
- 400/401/404/409/429/502/504 错误契约；
- CSP、X-Frame-Options、Referrer-Policy、nosniff 和限流；
- 5 类 SOP × 2 轮真实模型，连续 10/10 完整成功；
- 三专家有效、Moderator、决策节点、数字护照、历史保存；
- 桌面/移动端浏览器、无横向溢出、无障碍和降级路径；
- 性能 trace、控制台错误和分享链接；
- OKX.AI ASP 激活/审核、90 秒视频、X 帖子和 Google Form 材料。

```bash
bash scripts/prod-verify-10round.sh https://your-host.example
bash scripts/prod-verify-error-contracts.sh https://your-host.example
```

FakeProvider 测试不能替代真实模型验收；本地通过也不能替代 Railway 重新部署后的证据。

## 9. 回退与外部动作

已合并的错误通过 Revert PR 回退，禁止直接重写 `main`：

```bash
git switch -c revert/<short-sha> origin/main
git revert <SQUASH_COMMIT_SHA>
git push -u origin HEAD
gh pr create --fill --base main
```

以下动作必须得到仓库所有者明确授权：首次 Push、修改分支保护、邀请成员、合并发布 PR、Railway 部署、配置/轮换 Secret、激活 OKX.AI、发布 X 帖子和提交 Google Form。普通本地编辑、测试、Worktree 管理和审查可自动执行。

## 10. 实时事实来源

GitHub Issue、Project、PR、Review Thread、CI 和部署日志是唯一实时事实来源。聊天中的状态快照仅用于交接，不得作为发布依据。每次合并或部署后更新对应 Issue 和验收文档。
