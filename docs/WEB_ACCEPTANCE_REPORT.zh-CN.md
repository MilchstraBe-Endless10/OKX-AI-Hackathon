# SOPscape Council Web 验收报告

## 范围

本报告只记录开发者 B 的前端、浏览器和可访问性验收，不替代后端真实模型稳定性验收。

## 已验证

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| Web Vitest | 37/37 | `pnpm --filter @sopscape/web test -- --run --maxWorkers=1 --minWorkers=1` |
| Web TypeScript | 通过 | `pnpm --filter @sopscape/web typecheck` |
| Web Build | 通过 | `pnpm --filter @sopscape/web build` |
| ESLint | 通过 | `pnpm exec eslint apps/web/src` |
| 桌面 Lighthouse Accessibility | 100 | 本地 Chromium DevTools，`http://localhost:5173/` |
| 移动 Lighthouse Accessibility | 100 | 本地 Chromium DevTools，`http://localhost:5173/` |
| SEO | 100 | 本地 Lighthouse |
| 移动端横向溢出 | 无 | `document.documentElement.scrollWidth <= innerWidth` |
| 语言菜单 | 10 种 | 中文、英语、印地语、西班牙语、阿拉伯语、法语、孟加拉语、葡萄牙语、俄语、日语 |
| 主题 | 通过 | 深色、浅色、跟随系统 |
| 3D Canvas | 存在 | 初始页面有单一 Canvas |
| 3D 旋转 | 已实现 | 鼠标中键拖拽，移动端保留降级路径 |

## 生产环境观察

生产首页和 `/health/ready` 可访问，页面静态资源加载正常。生产登录流程当前返回 HTTP 401，因此登录后的完整流程尚未获得有效证据：

```text
登录 → 提交 SOP → 三专家结果 → 决策 → 数字护照 → 历史 → 分享
```

该问题属于生产身份配置或凭据状态，不在 B 的前端代码范围内。

## 当前阻塞

1. `@playwright/test` 安装受到网络超时影响，尚未生成 Playwright CLI 报告。
2. 生产登录返回 401，无法完成认证后的浏览器闭环。
3. FPS、1% Low、Draw Calls、Triangles、内存增长仍需在正式发布候选版本上采集。

## 发布前要求

- A 修复并验证生产登录后，重新运行认证闭环；
- PR #7 合并并部署后，确认 Railway 部署 Commit SHA；
- 使用真实生产环境完成桌面和移动端浏览器验收；
- 不把 Lighthouse 本地结果当作生产模型稳定性或 10 轮演练证据。
