# OKX.AI 上架验证清单

## 前置条件

- [ ] 公网域名已配置
- [ ] HTTPS 证书已安装
- [ ] MODEL_API_KEY 已配置
- [ ] MODEL_BASE_URL 已配置
- [ ] MODEL_NAME 已配置
- [ ] SOPSCAPE_API_KEY 已生成

## 验证步骤

### 1. 模型验证

```bash
# 配置环境变量
export MODEL_API_KEY="your-api-key"
export MODEL_BASE_URL="https://api.okx.ai/v1"
export MODEL_NAME="your-model-name"

# 运行验证脚本
./scripts/validate-model.sh
```

预期输出：
- ✓ Connectivity test passed
- ✓ JSON response test passed
- ✓ Chinese SOP analysis test passed
- ✓ Latency test passed (P95 < 10s)

### 2. 部署验证

```bash
# 运行部署脚本
./deploy/deploy.sh

# 验证健康检查
curl https://your-domain.com/health/live
# Expected: {"status":"ok"}

curl https://your-domain.com/health/ready
# Expected: {"status":"ready"} or {"status":"not_ready","reason":"..."}
```

### 3. A2MCP API 验证

```bash
# 测试 generate-rehearsal
curl -X POST https://your-domain.com/a2mcp/generate-rehearsal \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SOPSCAPE_API_KEY" \
  -d '{"title":"钓鱼邮件处置","content":"收到可疑邮件后：不点击链接、独立核验、上报"}'

# Expected: HTTP 200 with council result
```

### 4. Web 应用验证

访问 https://your-domain.com 并验证：
- [ ] 登录页面正常显示
- [ ] 可以成功登录
- [ ] 3D 指挥室正常渲染
- [ ] 可以提交 SOP 并生成分析
- [ ] 决策选择后风险路径更新
- [ ] 主题切换功能正常
- [ ] 语言切换功能正常

### 5. 安全验证

```bash
# 检查安全响应头
curl -I https://your-domain.com | grep -E "Content-Security|X-Frame|X-Content"

# Expected headers:
# Content-Security-Policy: ...
# X-Frame-Options: SAMEORIGIN
# X-Content-Type-Options: nosniff
```

### 6. 性能验证

```bash
# 使用 ab 进行压力测试
ab -n 100 -c 10 https://your-domain.com/health/live

# Expected:
# Complete requests: 100
# Failed requests: 0
# Requests per second: > 50
```

## 上架提交材料

- [ ] 90 秒演示视频
- [ ] X 帖子（含 #OKXAI 标签）
- [ ] Google Form 提交链接
- [ ] 项目截图（桌面 + 移动端）
- [ ] 演示账号信息

## 完成标准

所有验证项目通过后，提交 OKX.AI 上架申请。
