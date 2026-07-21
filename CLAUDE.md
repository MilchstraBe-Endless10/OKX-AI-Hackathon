# CLAUDE.md

## gstack（Claude Skill 调用必需）

本项目使用每位开发者自己的全局 gstack 安装，不提交任何指向个人 `$HOME` 的项目内符号链接。

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

`.claude/hooks/check-gstack.sh` 在 Claude 调用 Skill 前验证安装；它不是对所有 Bash/Edit 操作的通用拦截器。

All web browsing MUST use the gstack `/browse` skill. Never use `mcp__claude-in-chrome__*` tools for browsing.

### Available gstack skills

- `/browse` — web browsing
- `/office-hours`
- `/plan-ceo-review`
- `/plan-eng-review`
- `/plan-design-review`
- `/design-consult`
- `/design-shotgun`
- `/design-html`
- `/review`
- `/ship`
- `/land-and-deploy`
- `/canary`
- `/benchmark`
- `/connect-chrome`
- `/qa`
- `/qa-only`
- `/design-review`
- `/setup-browser-cookies`
- `/setup-deploy`
- `/setup-gbrain`
- `/retro`
- `/investigate`
- `/document-release`
- `/document-generate`
- `/codex`
- `/cso`
- `/autoplan`
- `/plan-devex-review`
- `/devex-review`
- `/careful`
- `/freeze`
- `/guard`
- `/unfreeze`
- `/gstack-upgrade`
- `/learn`
