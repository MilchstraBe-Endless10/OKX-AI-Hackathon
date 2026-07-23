# OKX.AI 上架验证指南

## 前提条件

- ✅ 部署到公网 HTTPS 域名
- ✅ 配置真实 MODEL_API_KEY
- ✅ 所有健康检查端点正常
- ✅ A2MCP 接口返回 200 状态码
- ✅ Web 应用正常渲染 3D 指挥室
- ✅ 无浏览器控制台错误

## 验证清单

### 1. 基础设施验证

#### 1.1 HTTPS 证书验证

```bash
# 检查 SSL 证书
openssl s_client -connect your-domain.com:443 -servername your-domain.com < /dev/null | \
  openssl x509 -noout -dates -subject
```

预期输出：
- `notBefore` 应该是过去时间
- `notAfter` 应该是未来时间 (至少 30 天)
- `subject` 应该匹配你的域名

#### 1.2 端口连通性

```bash
# 检查 HTTP
curl -I http://your-domain.com

# 检查 HTTPS
curl -I https://your-domain.com

# 检查健康端点
curl https://your-domain.com/health/live
```

预期输出：
- HTTP: 301/302 重定向到 HTTPS
- HTTPS: 200 状态码
- `/health/live`: `{"status":"ok"}`

#### 1.3 安全响应头

```bash
curl -I https://your-domain.com | grep -E "Content-Security|X-Frame|X-Content"
```

预期输出：
- `Content-Security-Policy`: 存在且限制严格
- `X-Frame-Options`: DENY 或 SAMEORIGIN
- `X-Content-Type-Options`: nosniff

### 2. A2MCP 能力验证

#### 2.1 POST /a2mcp/generate-rehearsal

```bash
curl -X POST https://your-domain.com/a2mcp/generate-rehearsal \
  -H "Content-Type: application/json" \
  -d '{
    "title": "钓鱼邮件处置",
    "content": "收到可疑邮件后：不点击链接、独立核验发件人、上报安全团队"
  }'
```

预期响应：
```json
{
  "rehearsalId": "r-1721712345678-1",
  "status": "READY",
  "consensus": [...],
  "disagreements": [],
  "evidenceGaps": [],
  "recommendedPath": ["verify", "report"],
  "decisionNodes": [...]
}
```

#### 2.2 模型调用稳定性测试

执行 10 次连续调用：

```bash
for i in {1..10}; do
  echo "Test $i:"
  curl -X POST https://your-domain.com/a2mcp/generate-rehearsal \
    -H "Content-Type: application/json" \
    -d '{"title":"test","content":"test content"}' \
    -w "%{http_code}\n" -o /dev/null
  sleep 2
done
```

预期：所有请求返回 200，响应时间 < 10 秒

### 3. Web 应用验证

#### 3.1 桌面浏览器验证

在 Chrome/Firefox 中打开 `https://your-domain.com`

检查项：
- ✅ 3D 指挥室正常渲染
- ✅ 鼠标中键可以旋转视角
- ✅ 主题切换 (深色/浅色/跟随系统)
- ✅ 语言切换 (10 种语言)
- ✅ 提交 SOP 后专家节点出现
- ✅ 决策后风险路径实时更新

#### 3.2 移动浏览器验证

在移动设备或开发者工具移动模式下检查：

检查项：
- ✅ 单 Canvas 渲染
- ✅ 无横向溢出
- ✅ 按钮触摸目标 ≥ 44px
- ✅ 3D 视角移动降级
- ✅ 主题和语言选择器可用

#### 3.3 控制台检查

打开浏览器开发者工具 Console：

检查项：
- ✅ 零错误
- ✅ 无 API Key 泄露警告
- ✅ 无 WebGL 错误
- ✅ 无未捕获的 Promise rejection

### 4. 安全验证

#### 4.1 输入验证测试

```bash
# 发送无效 JSON
curl -X POST https://your-domain.com/a2mcp/generate-rehearsal \
  -H "Content-Type: application/json" \
  -d 'invalid json'
```

预期：返回 HTTP 400 Bad Request

```bash
# 发送空内容
curl -X POST https://your-domain.com/a2mcp/generate-rehearsal \
  -H "Content-Type: application/json" \
  -d '{"title":"","content":""}'
```

预期：返回 HTTP 400 with VALIDATION_ERROR

#### 4.2 58 秒 Deadline 验证

在代码中启用 SlowFakeProvider 或网络延迟模拟：

预期：58 秒后返回 HTTP 504 Gateway Timeout

### 5. 性能验证

#### 5.1 响应时间测试

```bash
# 测量平均响应时间
time curl -X POST https://your-domain.com/a2mcp/generate-rehearsal \
  -H "Content-Type: application/json" \
  -d '{"title":"test","content":"test content"}'
```

预期：响应时间 < 10 秒 (真实模型)

#### 5.2 并发测试

```bash
# 安装 Apache Bench
sudo apt install apache2-utils

# 10 个并发用户，总共 100 个请求
ab -n 100 -c 10 -T 'application/json' \
  -p test-data.json \
  https://your-domain.com/a2mcp/generate-rehearsal
```

预期：无 5xx 错误，95% 请求成功

## 常见问题排查

### 问题 1：模型 API 超时

```bash
# 检查 MODEL_BASE_URL 连通性
curl -I $MODEL_BASE_URL

# 检查 API Key 有效性
curl -X POST $MODEL_BASE_URL/chat/completions \
  -H "Authorization: Bearer $MODEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"test"}]}'
```

### 问题 2：HTTPS 证书问题

```bash
# 检查证书有效期
openssl s_client -connect your-domain.com:443 | openssl x509 -noout -dates

# 更新证书
sudo certbot renew
sudo systemctl reload nginx
```

## 上架前最终检查

运行完整的验证脚本：

```bash
#!/bin/bash

echo "=== SOPscape OKX.AI Listing Verification ==="

echo "1. Checking HTTPS..."
curl -sI https://your-domain.com | head -1

echo "2. Checking health endpoint..."
curl -s https://your-domain.com/health/live

echo "3. Testing A2MCP generate-rehearsal..."
curl -sX POST https://your-domain.com/a2mcp/generate-rehearsal \
  -H "Content-Type: application/json" \
  -d '{"title":"test","content":"test content"}' | head -20

echo "4. Checking response headers..."
curl -sI https://your-domain.com | grep -E "Content-Security|X-Frame|X-Content"

echo "=== Verification Complete ==="
```

## 通过标准

所有检查项都通过 ✅ 后，即可提交 OKX.AI 上架申请：

- ✅ HTTPS 证书有效
- ✅ 所有 A2MCP 端点正常响应
- ✅ Web 应用在桌面和移动端正常工作
- ✅ 控制台零错误
- ✅ 安全配置正确
- ✅ 性能稳定
- ✅ 58 秒 Deadline 生效
- ✅ 输入验证正常
