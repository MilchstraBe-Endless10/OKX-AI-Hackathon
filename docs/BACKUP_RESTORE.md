# SOPscape Council — SQLite 备份与恢复流程

## 数据位置

默认 SQLite 数据库位置：
- 开发环境：`./data/sopscape.sqlite`
- 生产环境：`/var/lib/sopscape/data/sopscape.sqlite`

## 自动备份

### 每日备份脚本

创建 `backup-sopscape.sh`：

```bash
#!/bin/bash
# SOPscape 每日备份脚本

BACKUP_DIR="/var/lib/sopscape/backups"
DB_PATH="/var/lib/sopscape/data/sopscape.sqlite"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/sopscape-$DATE.sqlite"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 执行备份
cp "$DB_PATH" "$BACKUP_FILE"

# 压缩备份
gzip "$BACKUP_FILE"

# 删除 30 天前的备份
find "$BACKUP_DIR" -name "sopscape-*.sqlite.gz" -mtime +30 -delete

# 记录日志
echo "$(date): Backup completed: $BACKUP_FILE.gz" >> /var/log/sopscape-backup.log
```

### 设置 Crontab

```bash
# 编辑 crontab
crontab -e

# 添加每日 2:30 AM 自动备份
30 2 * * * /path/to/backup-sopscape.sh
```

## 手动备份

### 方法 1：复制数据库文件

```bash
# 直接复制
cp /var/lib/sopscape/data/sopscape.sqlite ./backup-$(date +%Y%m%d).sqlite

# 使用 SQLite 导出
sqlite3 /var/lib/sopscape/data/sopscape.sqlite .dump > backup-$(date +%Y%m%d).sql
```

### 方法 2：使用 SQLite VACUUM

```bash
# 优化并备份
sqlite3 /var/lib/sopscape/data/sopscape.sqlite "VACUUM INTO 'backup-$(date +%Y%m%d).sqlite';"
```

## 数据恢复

### 从 SQLite 文件恢复

```bash
# 停止服务
pm2 stop sopscape

# 备份当前数据库
cp /var/lib/sopscape/data/sopscape.sqlite /var/lib/sopscape/data/sopscape.sqlite.corrupt

# 恢复备份
cp /path/to/backup-sopscape.sqlite /var/lib/sopscape/data/sopscape.sqlite

# 重启服务
pm2 start sopscape
```

### 从 SQL Dump 恢复

```bash
# 创建新数据库
sqlite3 /var/lib/sopscape/data/sopscape.sqlite < backup-20240723.sql
```

## 数据完整性检查

### 检查数据库完整性

```bash
sqlite3 /var/lib/sopscape/data/sopscape.sqlite "PRAGMA integrity_check;"
```

应该返回：`ok`

### 验证表结构

```bash
sqlite3 /var/lib/sopscape/data/sopscape.sqlite ".tables"
```

应该显示：`sops versions rehearsals decisions training audit_events metrics`

## 监控与报警

### 备份监控

创建 `check-backups.sh`：

```bash
#!/bin/bash

BACKUP_DIR="/var/lib/sopscape/backups"
LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/sopscape-*.sqlite.gz 2>/dev/null | head -1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "ALERT: No backups found!"
    exit 1
fi

BACKUP_AGE_SECONDS=$(($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")))
BACKUP_AGE_HOURS=$((BACKUP_AGE_SECONDS / 3600))

if [ $BACKUP_AGE_HOURS -gt 48 ]; then
    echo "ALERT: Latest backup is $BACKUP_AGE_HOURS hours old!"
    exit 1
fi

echo "OK: Latest backup is $LATEST_BACKUP ($BACKUP_AGE_HOURS hours old)"
exit 0
```

### 设置监控

```bash
# 添加到 crontab 每小时检查
0 * * * * /path/to/check-backups.sh
```

## 云存储备份 (可选)

### 上传到 S3

安装 AWS CLI：

```bash
sudo apt install awscli
aws configure
```

修改备份脚本：

```bash
# 上传到 S3
aws s3 cp "$BACKUP_FILE.gz" s3://your-bucket/sopscape-backups/
```

## 灾难恢复流程

### 场景 1：数据库损坏

```bash
# 1. 停止服务
pm2 stop sopscape

# 2. 检查损坏
sqlite3 /var/lib/sopscape/data/sopscape.sqlite "PRAGMA integrity_check;"

# 3. 从最新备份恢复
BACKUP=$(ls -t /var/lib/sopscape/backups/sopscape-*.sqlite.gz | head -1)
gunzip -c "$BACKUP" > /var/lib/sopscape/data/sopscape.sqlite

# 4. 重启服务
pm2 start sopscape

# 5. 验证数据
curl http://localhost:3000/api/workspace
```

### 场景 2：服务器完全丢失

```bash
# 1. 在新服务器上部署代码
git clone https://github.com/your-org/OKX-AI-Hackathon.git
cd OKX-AI-Hackathon
pnpm install --frozen-lockfile
pnpm build

# 2. 从 S3 或远程备份下载
aws s3 sync s3://your-bucket/sopscape-backups/ ./backups/

# 3. 恢复最新备份
LATEST=$(ls -t ./backups/sopscape-*.sqlite.gz | head -1)
gunzip -c "$LATEST" > /var/lib/sopscape/data/sopscape.sqlite

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 填入真实值

# 5. 启动服务
pm2 start apps/server/dist/index.js --name sopscape
```

## 最佳实践

1. **每日备份**：自动备份到本地和云存储
2. **每周验证**：检查备份文件完整性
3. **异地存储**：至少保留一份异地备份
4. **加密备份**：敏感数据应加密存储
5. **测试恢复**：定期测试灾难恢复流程
6. **监控报警**：备份失败或超过时限立即报警
