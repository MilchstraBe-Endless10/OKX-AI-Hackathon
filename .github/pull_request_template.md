## 目的

<!-- 为什么需要这次改动？ -->

## 改动范围

<!-- 修改了什么？明确没有修改什么。 -->

## 风险、数据兼容性与回退

- 风险：
- 数据/Schema 兼容性：
- 回退步骤（合并后目标为 Squash Commit SHA）：

## 验证证据

```text
填写实际执行的命令、退出码和关键结果；不要写“应该通过”。
```

## 高风险边界

- [ ] 修改 Contract 或 Fixture
- [ ] 修改数据库 Migration
- [ ] 修改权限、Capability、Session 或 Secret
- [ ] 修改 A2MCP 58 秒 Deadline 或 MCP 协议
- [ ] 修改依赖或 Lockfile
- [ ] 修改 Three.js Render Loop、GSAP Director 或资源释放
- [ ] 修改外部部署/发布配置
- [ ] 以上均未修改

## Review 清单

- [ ] 已 Rebase 最新 `origin/main`
- [ ] 作者已运行 `hunk diff origin/main...HEAD`
- [ ] 格式、类型、Lint、测试和 Build 已通过
- [ ] 没有提交 Secret、Token、原始 SOP/Prompt/Capability/Session
- [ ] 新增或修改行为有可运行验证
- [ ] 无未解决的 Review Thread
- [ ] 另一名开发者已批准
