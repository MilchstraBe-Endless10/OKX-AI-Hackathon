# SOPscape Council 两人团队 Git、Worktree、Hunk 与 GitHub 协作规范

> 状态：待执行的团队协作规范。
> 编制日期：2026-07-21。
> 落地状态：已在 `docs/team-collaboration-and-project-overview` 分支建立协作文档和本地审查配置；Git Remote 仍等待真实的 `OWNER/REPOSITORY`。
> 外部动作边界：创建 GitHub 仓库、邀请成员、推送、创建 PR、修改分支保护均需仓库所有者明确执行或授权。

## 1. 推荐结论

两名开发者采用以下最小协作模型：

- `main` 只用于集成和发布，禁止直接开发；
- 每个任务创建独立短分支和独立 Git Worktree；
- 开发者 A 负责 Core、数据库、A2MCP 和 MCP；
- 开发者 B 负责 Web、3D、GSAP、六组件和浏览器 E2E；
- Contract 由 A 维护，B 使用固定 Fixture 并通过 PR 请求 Contract 变更；
- 所有合并必须经过另一名开发者 Review、Hunk 检查和 CI；
- 使用 Squash Merge 保持主分支可回退；线上/主分支问题只用 `git revert`，不重写共享历史；
- gstack 和 Hunk 是每位成员本地安装的开发工具，不作为应用运行依赖提交。

## 2. 新成员机器初始化

### 2.1 安装 gstack

每个成员必须在自己的机器执行一次：

```bash
git clone --single-branch --depth 1 \
  https://github.com/garrytan/gstack.git \
  ~/.claude/skills/gstack

cd ~/.claude/skills/gstack
./setup --team
```

然后克隆 SOPscape Council 仓库。团队依赖每位成员自己的全局安装；项目不提交指向某个开发者 `$HOME` 的绝对符号链接。

如果仓库已经克隆，也可以先安装 gstack，再重新启动 AI 编码工具。`.claude/hooks/check-gstack.sh` 会在缺少 gstack 时阻止 Claude Skill 调用，但不会拦截全部 Bash/Edit 操作。

检查：

```bash
test -x ~/.claude/skills/gstack/setup
test -x ~/.claude/skills/gstack/bin/gstack-team-init
```

禁止提交 `~/.claude/skills/gstack` 的实际内容，也不要让两名成员共享同一个 Home 目录安装。Kiro/OpenCode 用户分别在 gstack 安装目录运行 `./setup --host kiro` 或 `./setup --host opencode`。

### 2.2 安装 Hunk

Hunk 是本地 Review 工具，不加入应用 `package.json`：

```bash
# 任意平台，要求 Node.js 18+
npm install -g hunkdiff

# 或当前 Homebrew Core
brew install hunk
# 如果本机 Core 尚未提供
brew install modem-dev/tap/hunk

hunk --version
```

Hunk 官方定位是“面向审查的终端 Diff Viewer”，支持当前工作树、Commit、Watch、Git Pager 和 Agent 注释。它提高审查效率，但不能替代测试、安全扫描或 GitHub PR Review。

推荐使用显式命令，不全局替换 Git Pager：

```bash
hunk diff
hunk diff --watch
hunk show HEAD
hunk show HEAD~1
```

如果个人希望使用 Git Alias：

```bash
git config --global alias.hdiff '-c core.pager="hunk pager" diff'
git config --global alias.hshow '-c core.pager="hunk pager" show'
```

项目落地阶段可增加 `.hunk/config.toml`：

```toml
mode = "auto"
vcs = "git"
watch = false
exclude_untracked = false
line_numbers = true
wrap_lines = false
agent_notes = false
```

### 2.3 基础 Git 配置

每位成员使用自己的身份：

```bash
git config --global user.name "YOUR_NAME"
git config --global user.email "YOUR_GITHUB_EMAIL"
git config --global pull.ff only
git config --global fetch.prune true
git config --global rerere.enabled true
git config --global merge.conflictStyle zdiff3
```

`rerere` 可以复用已经解决过的冲突；`zdiff3` 会显示 Base/Current/Incoming，更适合两人定位真正差异。

## 3. GitHub 连接和认证

### 3.1 推荐：SSH 负责 Git，GitHub CLI 负责 PR

不需要把 API Token 发给队友或写进项目：

```bash
# 如本机还没有 SSH Key
ssh-keygen -t ed25519 -C "YOUR_GITHUB_EMAIL"

# 安装 gh 后使用浏览器授权
gh auth login --git-protocol ssh --web
gh auth status
```

仓库创建完成后添加远端：

```bash
git remote add origin git@github.com:OWNER/REPOSITORY.git
git remote -v
git push -u origin main
```

当前本地仓库没有 `origin`，因此在真正连接前必须提供：

- GitHub 仓库完整 URL，或 `OWNER/REPOSITORY`；
- 仓库是个人仓库还是 Organization 仓库；
- 默认分支最终使用 `main` 还是保留 `master`。

建议把当前 `master` 重命名为 `main`，但应在未发布远端或团队统一切换时一次完成：

```bash
git branch -m master main
```

### 3.2 如果确实需要 GitHub API

短期个人操作优先用 `gh auth login --web`，不需要手工管理 API Key。必须做自动化时，创建只允许访问本仓库的 Fine-grained Personal Access Token；两名开发者不得共用同一个 Token。

开发/PR 所需最小 Repository Permissions：

| 权限 | 建议 |
|---|---|
| Metadata | Read，GitHub 自动要求 |
| Contents | Read and write，用于 Branch/Commit/Push |
| Pull requests | Read and write，用于创建和管理 PR |
| Issues | Read and write，仅在使用 Issue 时开启 |
| Actions | Read，用于查看 CI；需要管理 Run 时再开 Write |
| Workflows | 默认不开；只有修改 `.github/workflows/*` 时临时开启 Write |
| Administration | 普通开发者不开；由仓库所有者管理分支保护 |

Token 只放操作系统凭据管理器、GitHub CLI 凭据存储或 CI Secret。禁止：

- 写入 `.env` 后提交；
- 粘贴进聊天、Issue、PR、截图或日志；
- 放在 Remote URL；
- 两人共享 Token；
- 使用无过期时间且覆盖全部仓库的 Classic Token。

命令行自动化可使用：

```bash
export GH_TOKEN="从安全凭据管理器注入，不要直接写入 Shell 历史"
gh auth status
gh repo view OWNER/REPOSITORY
```

直接 REST API 的基础地址为 `https://api.github.com`：

```bash
curl --fail-with-body \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/OWNER/REPOSITORY
```

长期自动化、Organization 级访问或机器人服务应改用 GitHub App，而不是长期 PAT。

## 4. Branch 与 Worktree 规则

### 4.1 主目录只做集成

仓库主目录只保留 `main`，用于 Fetch、合并后验证、打 Tag 和发布。功能开发全部在相邻 Worktree 中进行。

不要把 Worktree 放进仓库目录，避免被误识别为未跟踪文件。推荐：

```text
../OKX_AI_Hackathon-wt/
  dev-a-core-a2mcp/
  dev-a-mcp/
  dev-b-web-shell/
  dev-b-decision-ui/
```

### 4.2 分支命名

```text
feat/core-orchestration
feat/a2mcp-adapter
feat/mcp-streamable-http
feat/web-command-room
feat/decision-causality
test/protocol-security
fix/session-restart
docs/team-workflow
```

一个分支只解决一个可 Review 的问题。预计超过一天或同时跨越多个所有权区时，先拆分。

### 4.3 创建 Worktree

```bash
cd /path/to/OKX_AI_Hackathon
git fetch origin --prune
git switch main
git pull --ff-only

mkdir -p ../OKX_AI_Hackathon-wt
git worktree add \
  ../OKX_AI_Hackathon-wt/dev-a-core-a2mcp \
  -b feat/core-a2mcp \
  origin/main

cd ../OKX_AI_Hackathon-wt/dev-a-core-a2mcp
```

同一个 Branch 不能同时 Checkout 到两个 Worktree。两名成员各自机器上的 Worktree 是本地工作区，不会被 GitHub 同步；真正同步的是 Branch 和 Commit。

### 4.4 日常同步

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
```

推送和创建 PR：

```bash
git push -u origin HEAD
gh pr create --fill --base main
```

PR 被别人合并后清理：

```bash
cd /path/to/OKX_AI_Hackathon
git switch main
git pull --ff-only
git worktree remove ../OKX_AI_Hackathon-wt/dev-a-core-a2mcp
gh pr view <PR_NUMBER> --json state --jq .state
git branch -D feat/core-a2mcp # 只限已确认 MERGED 且 Worktree 干净
git worktree prune
```

## 5. 两名开发者具体分工

### 5.1 开发者 A：后端、协议与关键路径

独占责任：

- `packages/contracts`；
- `packages/core`；
- PostgreSQL Migration 和数据库访问；
- Web API 的授权、幂等、限流和能力令牌；
- 免费 A2MCP、58 秒 Deadline 和部署；
- 完整 MCP Transport、Session、Tools、Resources、Prompts、Progress；
- 健康检查、Shutdown、Retention 和后端可观测性。

优先顺序：

```text
Contract/Fixture
→ Core Fixture 编排
→ A2MCP 公网纵向切片
→ MCP 完整协议
→ 权限/分享/重启
→ 后端性能与安全
```

### 5.2 开发者 B：产品体验与浏览器验证

独占责任：

- `apps/web`；
- Tailwind 主题和响应式布局；
- Three.js 固定指挥室、SceneAdapter、Render Loop 和 Dispose；
- GSAP Director、Camera Cues 和 reduced-motion；
- 三个 React Bits 与三个 21st.dev 组件的选择、接入和台账；
- SOP 输入、Agent 进度、决策、报告和分享页面；
- Chrome/移动/键盘/无障碍 E2E；
- FPS、资源释放、Bundle 和前端安全验证。

优先顺序：

```text
Fixture 驱动 DOM 流程
→ 指挥室 Shell
→ 六组件
→ 真实状态接入
→ 决策因果
→ 分享/报告
→ E2E/性能/无障碍
```

### 5.3 共同责任

- A 审查 B 的权限使用、接口映射和测试；
- B 审查 A 的错误信息、可用性、进度语义和演示真实性；
- 两人轮流做发布 Verifier：PR 作者不能独自批准自己的合并；
- 每天两次集成窗口，建议 UTC 04:00 和 12:00；
- ASP 外部提交、X 发布和最终表单由仓库负责人执行，不由某个开发分支自动完成。

## 6. 两人并行开发时如何减少冲突

### 6.1 先冻结 Contract，再并行

第一天由 A 提交最小 Contract PR，至少包含：

- `SopInput`；
- `GenerationProgress`；
- `WebOwnerRehearsal`；
- `WebShareRehearsal`；
- `SceneDocument`；
- `DecisionInput/Result`；
- `ApiError`；
- 两套合法和一套非法 Fixture。

B 不等待真实模型，直接使用这些 Fixture 开发页面和 3D。这样后端和前端可以真正并行。

### 6.2 Contract 修改协议

需要改 Schema 时：

1. 提交独立 `chore/contracts-*` 或 `feat/contracts-*` PR；
2. 先更新 Schema 测试和 Fixture；
3. A Review 兼容性，B Review UI 影响；
4. Contract PR 先合并；
5. 其他功能分支 Rebase `origin/main`；
6. 再合并依赖该变更的前后端 PR。

禁止在前端分支复制或临时改写一份同名 TypeScript 类型。

### 6.3 避免共享热点文件

| 文件区域 | 负责人 | 另一人如何变更 |
|---|---|---|
| `package.json`、Workspace、根 TS 配置 | A | 在 PR 描述提出需求，由 A 合并小变更 |
| `packages/contracts` | A | B 提交 Fixture/需求或独立 Contract PR |
| `apps/server/src/mcp` | A | B 只写客户端 Fixture/E2E |
| `apps/web` | B | A 通过 API Contract，不直接改 UI |
| `tests/e2e` | B | A 提供测试数据和后端辅助接口 |
| Release Evidence | 当日 Verifier | 另一人只提交原始结果 |

### 6.4 合并顺序

同一天存在依赖关系时：

```text
Contract/Migration
→ Core/A2MCP/MCP
→ Web 接入
→ Cross-adapter/E2E
→ Release 配置
```

无依赖的小 PR 可以并行 Review，但最终进入 `main` 时串行合并。每合并一个 PR，下一个 PR 必须更新到最新 `origin/main` 并重新通过 CI。

## 7. PR 与 Hunk 审查流程

### 7.1 作者检查

```bash
git fetch origin
git rebase origin/main
hunk diff origin/main...HEAD
pnpm verify
git status --short
```

作者在 PR 中填写：

- 为什么需要改；
- 改动范围和明确未改内容；
- 风险与回退 Commit；
- 测试命令和实际结果；
- UI 变更截图/录屏或协议 Fixture；
- 是否修改 Schema、Migration、Secret、权限、Deadline 或依赖。

### 7.2 审查者检查

```bash
PR=123
HEAD_REF=$(gh pr view "$PR" --json headRefName --jq .headRefName)
git fetch origin "$HEAD_REF"
git worktree add "../OKX_AI_Hackathon-wt/review-$PR" --detach FETCH_HEAD
cd "../OKX_AI_Hackathon-wt/review-$PR"
hunk diff origin/main...HEAD
pnpm verify
```

审查重点：

1. 是否跨越了约定所有权；
2. 是否复制 Core/Contract 逻辑；
3. 是否存在 Secret、原始 SOP/Prompt/Capability 泄漏；
4. 是否破坏 58 秒 Deadline、Session 重启失效或权限边界；
5. 是否增加第二 Render Loop/全局动画系统；
6. 测试是否能在修复前失败、修复后通过；
7. 是否有可执行回退方式。

Hunk 只展示 Diff；协议正确性、安全性和运行行为仍必须由测试证明。

### 7.3 合并门槛

- 至少另一名开发者 1 个 Approval；
- 所有 CI Required Checks 通过；
- Branch 已更新到最新 `main`；
- 未解决 Review Thread 为零；
- Hunk 人工审查完成；
- 使用 Squash Merge；
- 合并后删除远端功能分支。

## 8. 冲突解决标准流程

PR 出现冲突时由 PR 作者处理，目标文件负责人参与判断：

```bash
git fetch origin
git rebase origin/main

# 查看冲突
git status

# 手工解决后
git add <resolved-files>
git rebase --continue

# 确认没有残留标记
git grep -nE '^(<<<<<<<|=======|>>>>>>>)' -- . ':!*.lock'

hunk diff origin/main...HEAD
pnpm verify
git push --force-with-lease
```

规则：

- 只允许对个人功能分支使用 `--force-with-lease`；
- 禁止对 `main` Force Push；
- Lockfile 冲突不要手工拼接：保留正确的 Manifest，重新运行包管理器生成 Lockfile；
- Migration 编号冲突由 A 重新编号并验证空库升级；
- Contract 冲突先确认业务语义，再处理文本；不能简单选择 ours/theirs；
- 两人对同一行为无法达成一致时，以已批准 PRD、测试规范和失败 Fixture 为裁决依据。

## 9. 回退策略

### 9.1 未提交改动

```bash
git diff
git restore --staged <file>
git restore <file>
```

执行 `restore` 前必须先用 Hunk 检查，避免丢失有价值改动。

### 9.2 已提交但未合并

个人分支允许交互式 Rebase 或追加修复 Commit；不要改写别人正在使用的分支。

### 9.3 已合并到 main

```bash
git switch main
git pull --ff-only
git switch -c revert/<short-sha>
git revert <SQUASH_COMMIT_SHA>
git push -u origin HEAD
gh pr create --fill --base main
```

由另一名开发者审查并在 Required Checks 通过后合并 Revert PR，保留完整审计历史。禁止直接 Push、`git reset --hard` 和 Force Push 回退共享 `main`。

### 9.4 数据库回退

- Migration 默认只前进；
- 破坏性 Schema 变更使用 Expand → Migrate → Contract；
- 发布前保留数据库快照；
- 应用回退必须能兼容已部署的新旧 Schema；
- 不在截止日前执行不可逆数据删除。

### 9.5 发布标记

每个发布候选创建 Annotated Tag：

```bash
git tag -a rc-2026-07-26.1 -m "SOPscape Council release candidate 1"
git push origin rc-2026-07-26.1
```

Tag 不能替代 Commit SHA 和证据目录；二者都要记录。

## 10. GitHub 分支保护建议

仓库所有者在 GitHub 为 `main` 配置：

- Require a pull request before merging；
- Require 1 approval；
- Dismiss stale approvals when new commits are pushed；
- Require conversation resolution；
- Require status checks，至少 `typecheck`、`lint`、`unit`、`integration`、`security`、`build`；
- Require branches to be up to date；
- Block force pushes；
- Block deletions；
- 两名开发者都不允许绕过保护；
- 发布期启用 Merge Queue 或约定人工串行合并。

只有两个人时，不建议要求 2 个 Approval，否则无人可以合并。高风险 PR 采用“一人实现、另一人批准、作者合并”的闭环。

## 11. Commit 规范

本仓库 Commit 必须同时满足 Conventional Type 和 Lore Trailer：

```text
feat: enable deterministic council orchestration

Keep three specialist calls parallel while making moderator admission depend
on three schema-valid results.

Constraint: Moderator cannot run with partial specialist output
Rejected: Partial moderation | violates approved no-fallback scope
Confidence: high
Scope-risk: moderate
Directive: Preserve AttemptBudget accounting when adding providers
Tested: pnpm test:unit -- attempt-budget lifecycle orchestration
Not-tested: Live provider latency
```

禁止使用 `update`、`fix stuff`、`WIP final` 等无法审计的消息。

## 12. 每日两人协作节奏

```text
09:30（本地）  10 分钟：确认两人的 Branch、Worktree、今日接口和合并顺序
开发期间       各自在独立 Worktree；接口变化先提 Contract PR
午间集成       合并最小 Contract/Core PR，依赖分支 Rebase
下午开发       A 做协议关键路径，B 做体验与 E2E
晚间审查       交换 PR；Hunk + 最小测试 + 完整受影响层
收尾           更新 main、清理已合并 Worktree、记录验证证据和次日阻塞
```

每天最多保持每人一个主要功能分支和一个紧急修复分支，避免同时开启大量半成品 Worktree。

## 13. 首批建议 PR

按以下顺序拆分，降低冲突：

1. `chore/workspace-bootstrap`：Workspace、基础脚本、CI；
2. `feat/contracts-v1`：Schema、Fixture、投影；
3. `feat/core-fixture-orchestration`：生命周期、AttemptBudget、Fixture 编排；
4. `feat/a2mcp-public-slice`：A2MCP、数据库、部署；
5. `feat/web-command-room-shell`：DOM 流程、3D Shell、六组件；
6. `feat/mcp-streamable-http`：完整 MCP；
7. `feat/decision-share-flow`：因果决策、Owner/Share；
8. `test/release-verification`：E2E、安全、性能与发布证据。

PR 2 合并后，PR 3、5 可并行；PR 4 与 6 共享 Server 基础，建议由 A 串行；PR 7 等待 Core Decision Contract 和 Web Shell 稳定。

## 14. 落地时需要新增或修改的项目文件

进入执行模式后，建议用新分支一次性完成：

```text
CONTRIBUTING.md                     本规范的团队入口
.hunk/config.toml                  项目 Hunk 显示配置
.github/pull_request_template.md   PR 检查表
.github/CODEOWNERS                 获得两名 GitHub 用户名后再创建
.github/workflows/ci.yml           工程脚本存在后再创建
.gitignore                         只忽略本地 Secret/Artifact；Worktree 放仓库外
```

不要创建无效 CODEOWNERS 占位符，也不要在应用脚本尚不存在时提交永远成功的空 CI。

## 15. 参考资料

- Git Worktree 官方文档：https://git-scm.com/docs/git-worktree
- Hunk 官方仓库与安装/使用说明：https://github.com/modem-dev/hunk
- GitHub 认证说明：https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github
- GitHub Fine-grained PAT 管理：https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens
- Fine-grained PAT 权限表：https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens
