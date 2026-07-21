# SOPscape Council 团队开发规范

本项目由两名开发者并行完成。核心规则：`main` 只集成，每项修改使用独立 Branch 和 Worktree，经另一人 Review、Hunk 和 CI 后合并。

项目背景先阅读 [PROJECT_OVERVIEW.zh-CN.md](PROJECT_OVERVIEW.zh-CN.md)。

## 1. 本机准备

### gstack

你们虽然使用同一台 Ubuntu 26.04 电脑，但属于两个 Linux 用户。gstack、GitHub 登录和项目 Clone 都按用户隔离：A 安装到 A 的 `$HOME`，B 安装到 B 的 `$HOME`，不要共用一个 `~/.claude`，也不要用 `sudo` 安装。

两名用户分别登录自己的 Linux 账号并执行：

```bash
git clone --single-branch --depth 1 \
  https://github.com/garrytan/gstack.git \
  ~/.claude/skills/gstack
cd ~/.claude/skills/gstack
./setup --team
```

然后重启 AI 编码工具。项目的 `.claude/hooks/check-gstack.sh` 会在缺少安装时阻止技能调用。

两人不共享 gstack 目录，也不长期固定某个提交。每天开始时，两人各自在自己的账号更新并比较版本：

```bash
git -C ~/.claude/skills/gstack pull --ff-only
git -C ~/.claude/skills/gstack rev-parse --short HEAD
```

若其中一人更新后 SHA 不同，另一人同样执行 `pull --ff-only`；`setup` 提示依赖变化时，两人分别重新运行 `./setup --team`。不要让一个用户更新另一个用户的安装。gstack 只是各自 AI 工具的本地技能，真正的团队协作通过 GitHub Issue、Branch、PR 和 Review 完成。

同一台电脑也不要让两人操作同一个 Git 工作目录，否则 `.git/index`、当前 Branch、未提交文件和构建缓存会相互覆盖。A 使用当前本地仓库完成首次发布；首次 `main` Push 后，B 再按“首次发布与第二位开发者 Clone”在自己的 Home Clone。每人的 Worktree 也只能放在自己的 Home。协作内容通过远端 PR 同步，不通过 `/mnt` 下的共享未提交文件同步。

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

不要把 Token 发给队友或 AI。自动化必须使用 Fine-grained PAT 时，只授权本仓库和必要权限：Metadata Read、Contents Read/Write、Pull Requests Read/Write；只有修改 Actions Workflow 时才临时增加 Workflows Write。Token 只进入 GitHub CLI 凭据存储、操作系统密钥链或 CI Secret。

### 仓库所有者一次性设置

1. 在 GitHub 创建私有或公开仓库，并把 SSH 地址发给 A、B；
2. `Settings → Collaborators` 邀请另一名开发者；
3. `Settings → Branches → Add branch protection rule`，匹配 `main`，开启 Require a pull request、1 个 Approval、Require conversation resolution；CI 建好后再勾选真实存在的 Required Checks；
4. 创建 GitHub Project（Board 视图），列为 `Backlog / Ready / In progress / Review / Done / Blocked`；
5. 在 Project 的 Workflows 启用“Item closed → Status: Done”；若当前 Project 没有该工作流，合并 PR 后人工移到 Done；
6. 把仓库 Issue 加入 Project。不要把 Token 写进仓库。

仓库已经存在时不需要 GitHub API。每人只需用自己的 SSH Key 和 `gh auth login`。`gh` 会替当前 Linux 用户安全保存自己的登录凭据；A、B 不共享凭据。只有无人值守 CI 或脚本需要调用 GitHub 时，才在仓库 `Settings → Secrets and variables → Actions` 添加仓库级 Secret，并赋最小权限。

### 首次发布与第二位开发者 Clone

当前本地仓库还没有 Remote。仓库所有者创建空 GitHub 仓库并明确授权首次 Push 后，由 A 在**现有本地仓库**执行：

没有 `origin` 时执行：

```bash
git remote -v
git remote add origin git@github.com:OWNER/REPOSITORY.git
```

已有 `origin` 但地址错误时只修正地址：

```bash
git remote set-url origin git@github.com:OWNER/REPOSITORY.git
```

然后确认 `main`。本地已经存在时直接切换：

```bash
git switch main
```

只有在本地不存在 `main`，且当前分支就是团队确认的初始历史时，才改名：

```bash
git branch --show-current
git branch -m main
```

确认状态和提交历史后，获得仓库所有者对首次 Push 的明确授权再执行：

```bash
git status --short --branch
git log --oneline -5
git push -u origin main
git remote -v
```

首次 `main` Push 完成后，B 才在自己的 Linux 用户下 Clone：

```bash
git clone git@github.com:OWNER/REPOSITORY.git ~/src/OKX_AI_Hackathon
cd ~/src/OKX_AI_Hackathon
git remote -v # Clone 已自动创建 origin，不再执行 remote add
```

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

## 5. 明早启动流程（2026-07-22，Asia/Shanghai）

开始编码前先完成这 30 分钟同步：

1. 两人阅读 `PROJECT_OVERVIEW.zh-CN.md`、PRD、测试规范和中文执行手册；
2. A 复述输入、输出、三专家/主持人、免费 A2MCP 和完整 MCP；B 对照 PRD 纠偏；
3. 把明天任务建成 GitHub Issues，写清验收条件、负责人和依赖，并加入 Project；
4. GitHub Project/Issue/PR 是唯一实时进度；启动文档中的表格只是 Day-0 快照，不再更新；
5. A 先做工程基线与 Contract/Fixture PR；经人工授权 Push、B Review、人工授权合并后，B 才从最新 `origin/main` 创建 Web 分支；
6. 每项实现都从 Issue 创建 Branch，PR 必须写 `Closes #<issue>`。

两人可直接使用 [开发者 A/B AI 启动提示词](docs/TEAM_START_TOMORROW.zh-CN.md)，但 AI 不得代替另一名开发者批准 PR，也不得执行未授权的 Push、Merge、部署或第三方提交。

### 开发者 A 第一张 Issue

目标：建立最小可运行 Workspace，并冻结第一版 Contract/Fixture；不要第一天就接真实模型、数据库和完整 MCP。

```text
分支：feat/contracts-fixtures-baseline
产出：pnpm workspace、apps/server、packages/contracts、packages/core、tests/fixtures；根 Workspace 使用 `apps/*` 预留引用，但 A 不创建或修改 `apps/web`
验收：干净安装成功；typecheck/build/test 可运行；SopInput、CouncilResult、Scene、ApiError Schema 有失败/成功 Fixture
PR：A 获得明确授权后创建，B Review；这是后续并行工作的依赖 PR
```

### 开发者 B 第一张 Issue

目标：在 A 的基线 PR 已合并后，从最新 `origin/main` 证明交互骨架。

```text
分支：feat/web-command-room-shell
依赖：A 的基线/Fixture PR 已合并；B 先 `git fetch origin && git switch main && git pull --ff-only`，再创建分支
产出：输入区、生成进度区、Council 结果面板、固定 3D 指挥室 Canvas、移动端可操作降级
验收：Fixture 可驱动完整页面状态；只有一个 Three.js Render Loop；键盘可完成核心操作
PR：B 创建，A Review；Contract PR 先合并后再 Rebase
```

### 当天合并顺序

```text
A: Bootstrap + Contract/Fixture PR → 获授权 Push → B Review → 获授权合并
B: 从已更新 origin/main 创建 Web Shell 分支
A: 同时从已更新 origin/main 创建 Core/A2MCP 分支
B Web PR / A Core PR：各自验证、互审、串行合并
```

## 6. 每项需求的标准开发流程

1. 从 PRD 找到需求和测试规范中的证据项；
2. 创建一个 Issue：用户价值、范围外、验收条件、负责人、依赖；
3. 人工在 GitHub Project/Issue 更新负责人、Branch/PR 和阻塞；AI 默认只生成待粘贴草稿，获得明确外部写授权后才能调用 `gh` 修改；
4. 建 Branch/Worktree，先提交失败测试或固定 Fixture；
5. 做最小实现，运行局部验证；
6. `hunk diff origin/main...HEAD` 后请求人工授权，获准才 Push；
7. 获准后创建 PR，确认 GitHub 自动带入 `.github/pull_request_template.md`，填写 `Closes #Issue` 和实际验证证据；
8. 另一人 Review、Hunk、CI；作者修复并解决 Thread；
9. Squash Merge 后通过 `Closes #Issue` 关闭 Issue；Project 工作流自动移到 Done，未启用时人工移动。

## 7. 日常 Git 命令

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
install -d -m 700 "$HOME/.cache/sopscape"
PR_BODY=$(mktemp "$HOME/.cache/sopscape/pr.XXXXXX.md")
trap 'rm -f "$PR_BODY"' EXIT
cp .github/pull_request_template.md "$PR_BODY"
# 编辑 "$PR_BODY"，填写 Issue、验证证据和回退步骤
gh pr create --base main --title "feat: ..." --body-file "$PR_BODY"
```

也可以在 GitHub 网页点击 `Compare & pull request`；模板会自动出现。创建 PR 后必须把模板注释替换为真实内容，不能原样提交空模板。

项目脚本未建立前不得创建空的 `pnpm verify` 假成功脚本。初始化后，`verify` 至少覆盖格式、类型、Lint、Unit、Integration、安全和 Build。

## 8. 并行与合并

第一批工作先合并 Bootstrap、Contracts 和 Fixture。之后 B 与 A 都从同一个最新 `origin/main` 分别创建 Web 与 Core 分支，才开始并行。

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

## 9. 冲突处理

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

## 10. 回退

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

## 11. Commit 格式

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

## 12. PR Review 重点

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

## 13. Worktree 清理

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

## 14. 外部动作边界

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
