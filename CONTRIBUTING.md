# SOPscape Council 团队开发规范

本项目由两名开发者并行完成。核心规则：`main` 只集成，每项修改使用独立 Branch 和 Worktree，经另一人 Review、Hunk 和 CI 后合并。

项目背景先阅读 [PROJECT_OVERVIEW.zh-CN.md](PROJECT_OVERVIEW.zh-CN.md)。

## 1. 本机准备

### gstack

每位成员各自在自己的机器安装：

```bash
git clone --single-branch --depth 1 \
  https://github.com/garrytan/gstack.git \
  ~/.claude/skills/gstack
cd ~/.claude/skills/gstack
./setup --team
```

然后重启 AI 编码工具。项目的 `.claude/hooks/check-gstack.sh` 会在缺少安装时阻止技能调用。

项目不再提交指向某个开发者 `$HOME` 的 `.kiro/skills` 或 `.opencode/skills` 绝对符号链接。使用其他宿主时，在 gstack 安装目录执行各自的全局安装：

```bash
./setup --host kiro
./setup --host opencode
```

### Hunk

Hunk 是本地 Diff Review 工具，不是应用依赖：

```bash
npm install -g hunkdiff
# 或当前 Homebrew Core：brew install hunk
# 如果本机 Core 尚未提供：brew install modem-dev/tap/hunk
hunk --version
```

常用命令：

```bash
hunk diff
hunk diff --watch
hunk show HEAD
hunk diff origin/main...HEAD
```

### Git

```bash
git config --global user.name "YOUR_NAME"
git config --global user.email "YOUR_GITHUB_EMAIL"
git config --global pull.ff only
git config --global fetch.prune true
git config --global rerere.enabled true
git config --global merge.conflictStyle zdiff3
```

## 2. GitHub 认证

推荐 SSH 负责 Git，GitHub CLI 负责 PR：

```bash
ssh-keygen -t ed25519 -C "YOUR_GITHUB_EMAIL" # 没有 Key 时才执行
gh auth login --git-protocol ssh --web
gh auth status
```

仓库所有者提供真实地址后连接：

```bash
git remote add origin git@github.com:OWNER/REPOSITORY.git
git remote -v
```

不要把 Token 发给队友或 AI。自动化必须使用 Fine-grained PAT 时，只授权本仓库和必要权限：Metadata Read、Contents Read/Write、Pull Requests Read/Write；只有修改 Actions Workflow 时才临时增加 Workflows Write。Token 只进入 GitHub CLI 凭据存储、操作系统密钥链或 CI Secret。

## 3. 两人文件所有权

| 负责人 | 范围 |
|---|---|
| 开发者 A | `packages/contracts`、`packages/core`、PostgreSQL、Web API、A2MCP、`apps/server/src/mcp`、部署 |
| 开发者 B | `apps/web`、Three.js、GSAP、六组件、浏览器 E2E、无障碍和前端性能 |

根 `package.json`、Workspace 和共享 TypeScript 配置由 A 合并小变更。B 需要修改 Contract 时先提交 Schema/Fixture PR，不复制一份前端类型。

## 4. Branch 和 Worktree

Worktree 放到仓库相邻目录，不放进仓库内部：

```bash
cd /path/to/OKX_AI_Hackathon
git fetch origin --prune
git switch main
git pull --ff-only

mkdir -p ../OKX_AI_Hackathon-wt
git worktree add \
  ../OKX_AI_Hackathon-wt/web-command-room \
  -b feat/web-command-room \
  origin/main
```

分支使用：

```text
feat/<scope>
fix/<scope>
test/<scope>
docs/<scope>
chore/<scope>
```

一个分支只处理一个可独立 Review 的目标。同一个 Branch 不能同时 Checkout 到两个 Worktree。

## 5. 每日开发流程

开始工作：

```bash
git fetch origin --prune
git rebase origin/main
```

提交前：

```bash
git status --short
hunk diff
pnpm verify
git add <明确列出的文件>
git commit
git push -u origin HEAD
gh pr create --fill --base main
```

项目脚本未建立前不得创建空的 `pnpm verify` 假成功脚本。初始化后，`verify` 至少覆盖格式、类型、Lint、Unit、Integration、安全和 Build。

## 6. 并行与合并

第一批工作先合并 Contracts 和 Fixture。B 使用 Fixture 开发 Web，A 同时实现 Core 和协议。

依赖合并顺序：

```text
Contract/Migration
→ Core/A2MCP/MCP
→ Web 接入
→ Cross-adapter/E2E
→ Release 配置
```

每次只串行合并一个 PR。下一个 PR 更新到最新 `origin/main` 并重新通过 CI 后才能合并。

合并门槛：

- 另一名开发者至少 1 个 Approval；
- Required Checks 全部通过；
- Branch 已更新到最新 `main`；
- Review Thread 全部解决；
- 作者和审查者均完成 Hunk 检查；
- 使用 Squash Merge；
- 合并后删除远端 Branch。

## 7. 冲突处理

```bash
git fetch origin
git rebase origin/main
git status

# 手工理解并解决冲突后
git add <resolved-files>
git rebase --continue

git grep -nE '^(<<<<<<<|=======|>>>>>>>)' -- . ':!*.lock'
hunk diff origin/main...HEAD
pnpm verify
git push --force-with-lease
```

`--force-with-lease` 只允许用于个人功能分支。禁止 Force Push `main`。Lockfile 冲突通过正确的 Manifest 重新生成，不手工拼接。

## 8. 回退

未合并的个人 Branch 可以修复或 Rebase。已合并到 `main` 的问题必须通过新的 Revert Branch 和 Revert PR 回退：

```bash
git switch main
git pull --ff-only
git switch -c revert/<short-sha>
git revert <SQUASH_COMMIT_SHA>
git push -u origin HEAD
gh pr create --fill --base main
```

由另一名开发者审查并在 Required Checks 通过后合并。禁止直接 Push、`reset --hard` 或 Force Push 共享 `main`。数据库 Migration 默认只前进，破坏性变更使用 Expand → Migrate → Contract。

## 9. Commit 格式

```text
feat: enable deterministic council orchestration

Keep three specialist calls parallel while moderator admission depends on
three schema-valid results.

Constraint: Moderator cannot run with partial specialist output
Rejected: Partial moderation | violates approved no-fallback scope
Confidence: high
Scope-risk: moderate
Directive: Preserve AttemptBudget accounting when adding providers
Tested: pnpm test:unit -- attempt-budget lifecycle orchestration
Not-tested: Live provider latency
```

首行使用 Conventional Type；Trailer 记录约束、被拒方案、风险和真实验证情况。

## 10. PR Review 重点

审查者不要在只保留 `main` 的主目录直接运行 `gh pr checkout`。使用独立 Review Worktree：

```bash
PR=123
HEAD_REF=$(gh pr view "$PR" --json headRefName --jq .headRefName)
git fetch origin "$HEAD_REF"
git worktree add "../OKX_AI_Hackathon-wt/review-$PR" --detach FETCH_HEAD
cd "../OKX_AI_Hackathon-wt/review-$PR"
hunk diff origin/main...HEAD
pnpm verify
```

重点检查：

- 是否跨越文件所有权；
- 是否复制 Core 或 Contract 逻辑；
- 是否泄漏 Secret、SOP、Prompt、Capability 或 Session；
- 是否破坏 A2MCP Deadline、MCP 重启失效或权限边界；
- 是否增加第二个 Render Loop 或全局动画系统；
- 测试是否能证明改动；
- 是否存在明确回退方式。

## 11. Worktree 清理

PR 合并后：

```bash
cd /path/to/OKX_AI_Hackathon
git switch main
git pull --ff-only
git worktree remove ../OKX_AI_Hackathon-wt/web-command-room

# 先确认远端 PR 已合并；Squash Merge 后普通 -d 通常会拒绝删除
gh pr view <PR_NUMBER> --json state --jq .state
git branch -D feat/web-command-room # 只限已经确认 MERGED 且 Worktree 干净的分支
git worktree prune
```

## 12. 外部动作边界

以下操作必须由仓库所有者明确授权：

- 创建或删除 GitHub 仓库；
- 添加 Remote 后首次 Push；
- 邀请 Collaborator；
- 修改 Branch Protection；
- 合并发布 PR；
- 部署生产环境；
- 提交 OKX.AI、发布 X 帖子或提交最终表单；
- 配置或轮换 Secret；
- 启用收费。
