# SOPscape Council — 部署指南

## 前提条件

- Node.js 24+
- pnpm 11+
- 域名指向服务器 IP
- (可选) Let's Encrypt 证书用于 HTTPS

## 快速开始 (HTTP 开发)

```bash
# 安装依赖
pnpm install --frozen-lockfile

# 构建
pnpm build

# 设置环境变量 (复制并编辑)
cp .env.example .env

# 启动
pnpm --filter @sopscape/server start
```

## HTTPS 生产部署

### 1. 获取 SSL 证书 (Let's Encrypt)

```bash
# 安装 certbot
sudo apt install certbot

# 获取证书
sudo certbot certonly --standalone -d your-domain.com
```

### 2. 配置环境变量

```bash
# .env (生产环境)
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
USE_HTTPS=true
SSL_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem
MODEL_API_KEY=your-actual-api-key
MODEL_BASE_URL=https://api.okx.ai/v1
MODEL_NAME=your-model-name
PUBLIC_APP_ORIGIN=https://your-domain.com
```

### 3. 启动服务

```bash
pnpm build
pnpm --filter @sopscape/server start
```

### 4. 验证

```bash
# 健康检查
curl https://your-domain.com/health/live

# A2MCP 测试
curl -X POST https://your-domain.com/a2mcp/generate-rehearsal \
  -H "Content-Type: application/json" \
  -d '{"title":"test","content":"test content"}'
```

## 反向代理 (Nginx 可选)

如果不使用 Node.js 原生 HTTPS，可以用 Nginx 反向代理：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## PM2 进程管理 (可选)

```bash
# 安装 PM2
npm install -g pm2

# 启动
pm2 start apps/server/dist/index.js --name sopscape-server

# 开机自启
pm2 startup
pm2 save
```

## OKX.AI 上架验证

1. 访问 `https://your-domain.com/health/live` → 返回 `{"status":"ok"}`
2. 访问 Web 应用 → 3D 指挥室正常渲染
3. 提交 SOP → A2MCP 返回真实模型结果
4. 决策反馈 → 风险拓扑实时更新
5. HTTPS 证书有效，无浏览器警告
