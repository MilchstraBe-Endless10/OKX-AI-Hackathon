# SOPscape Council 性能与发布验收报告

**测试时间**：2026-07-26（Asia/Shanghai）  
**生产地址**：https://sopscape-production.up.railway.app  
**候选版本**：`origin/main`（PR #10 已合并）

## 1. 已实测指标

| 指标 | 桌面 1440×900 | 移动 390×844 | 结论 |
|---|---:|---:|---|
| RAF 中位帧率 | 59.88 FPS | 59.88 FPS | 通过调度基线 |
| RAF 1% Low | 59.52 FPS | 59.52 FPS | 通过调度基线 |
| RAF 最低帧率 | 59.52 FPS | 59.52 FPS | 通过调度基线 |
| 页面 Canvas | 0 | 0 | 当前测试机 WebGL 不可用 |
| 实际 GPU Draw Calls | 未测 | 未测 | 不能用 0 作为 GPU 结果 |
| JS Heap（5 次导航） | 4.99→9.39 MiB | 同一浏览器进程 | 增长约 88%，需真实 WebGL/设备复测 |

> FPS 是 `requestAnimationFrame` 调度测量，不等价于 GPU 渲染 FPS。Chrome Headless 在 Ubuntu 26.04 本机启动 GPU 进程失败，页面进入 WebGL 降级路径，因此本报告**不伪造** Draw Calls、Triangles 或 GPU 内存结论。

## 2. Three.js 静态预算（代码可审计，不替代 renderer.info）

`apps/web/src/scene/CommandRoom.tsx` 的基础场景包含：3 个专家网格、1 个共识核心、3 条连接线、1 条风险线、1 个 GridHelper，以及每个证据节点 1 个八面体网格。

因此基础绘制预算为：

```text
Draw Calls = 9 + evidenceNodes.length
```

该数字是结构预算；上架前必须在真实 Chromium/WebGL 设备中读取：

```js
renderer.info.render.calls
renderer.info.render.triangles
renderer.info.memory.geometries
renderer.info.memory.textures
```

## 3. 生产预检

`node scripts/verify-okx-listing.mjs https://sopscape-production.up.railway.app`：

| 检查 | 结果 |
|---|---|
| `/health/live` | ✅ 200 |
| `/health/ready` | ✅ 200 |
| SPA | ✅ 200 |
| 非法输入 | ✅ 400 |
| `/mcp` 未授权 | ✅ 401 |
| 免费 A2MCP 结构化结果 | ❌ 502 |

502 响应符合 `PARTIAL_FAILED`/Problem Details 契约，但表示上游模型当前没有返回可用的三专家结果；因此不能将本轮称为 10/10 生产演练通过。

## 4. 5 轮内存观察

在本地生产构建、Headless Chrome CPU/WebGL 降级路径执行 5 次登录导航，JS heap 采样为：

```text
5,237,938 → 6,779,020 → 7,697,379 → 8,759,008 → 9,843,098 bytes
```

该结果受浏览器导航与垃圾回收时机影响，不能直接判定为应用泄漏；但已超过 `<10%` 观察阈值，必须在启用 WebGL 的真实 Chromium 或移动设备上复测 5 次“新建演练→完成→返回”循环。

## 5. 发布结论

- Railway 健康检查和安全边界：✅
- 真实三专家连续 10 轮：❌（当前上游 502，计数清零）
- 完整 GPU FPS/Draw Calls/Triangles：⚠️ 等待可用 WebGL Chromium
- ASP 最终激活：⚠️ 需要 OKX.AI 账户在网页中确认“激活/上架”
- X 帖子与 Google Form：⚠️ 已准备草稿，发布和提交需要用户账户授权
