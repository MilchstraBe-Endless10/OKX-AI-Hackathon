# SOPscape Council — 生产部署指南

## 前提条件

- 服务器：Ubuntu 20.04+ / Debian 11+
- Node.js 24+
- pnpm 11+
- 域名指向服务器 IP
- (可选) Let's Encrypt 证书
- OKX.AI 模型 API Key

## 快速部署

### 1. 获取代码

```bash
git clone https://github.com/your-org/OKX-AI-Hackathon.git
cd OKX-AI-Hackathon
```

### 2. 安装依赖

```bash
pnpm install --frozen-lockfile
```

### 3. 构建项目

```bash
pnpm build
```

### 4. 配置环境变量

```bash
# 复制并编辑环境变量
cp .env.example .env

# 使用真实值替换以下变量：
# - MODEL_API_KEY：你的 OKX.AI API Key
# - MODEL_BASE_URL：https://api.okx.ai/v1
# - MODEL_NAME：你的模型名称
# - SOPSCAPE_API_KEY：生成的强随机字符串 (用于 API 鉴权)
# - SOPSCAPE_DATABASE_PATH：SQLite 数据库路径
# - PUBLIC_APP_ORIGIN：你的域名
```

### 5. 生成长期 API Key

```bash
# 生成 32 字节随机字符串
openssl rand -hex 32
```

### 6. 启动服务

```bash
pnpm --filter @sopscape/server start
```

服务将在 `http://localhost:3000` 启动。

## HTTPS 配置

### 选项 1：Nginx 反向代理 (推荐)

```bash
# 安装 Nginx
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx

# 配置 Nginx
sudo nano /etc/nginx/sites-available/sopscape
```

Nginx 配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置并获取证书：

```bash
sudo ln -s /etc/nginx/sites-available/sopscape /etc/nginx/sites-enabled/
sudo certbot --nginx -d your-domain.com
```

### 选项 2：Node.js 原生 HTTPS

在 `.env` 中设置：

```bash
USE_HTTPS=true
SSL_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem
```

## 持久化配置

### SQLite 数据库

```bash
# 创建数据目录
mkdir -p /var/lib/sopscape/data

# 设置权限
chown -R $USER:$USER /var/lib/sopscape

# 在 .env 中设置
SOPSCAPE_DATABASE_PATH=/var/lib/sopscape/data/sopscape.sqlite
```

### 自动备份

添加到 crontab：

```bash
# 编辑 crontab
crontab -e

# 添加每天 2:30 AM 备份
30 2 * * * cp /var/lib/sopscape/data/sopscape.sqlite /var/lib/sopscape/backups/sopscape-$(date +\%Y\%m\%d).sqlite
```

## PM2 进程管理

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start apps/server/dist/index.js --name sopscape --env.production

# 设置开机自启
pm2 startup
pm2 save

# 查看日志
pm2 logs sopscape
```

## 健康检查

```bash
# 存活检查
curl http://localhost:3000/health/live

# 就绪检查
curl http://localhost:3000/health/ready
```

## 故障排查

### 端口被占用

```bash
# 查找占用 3000 端口的进程
sudo lsof -i :3000

# 或更改 PORT 环境变量
PORT=3001 pnpm --filter @sopscape/server start
```

### 数据库权限

```bash
# 确保 SQLite 文件可写
chmod 644 /var/lib/sopscape/data/sopscape.sqlite
```

### API 鉴权失败

检查请求头是否包含正确的 Bearer Token：

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/a2mcp/generate-rehearsal
```
