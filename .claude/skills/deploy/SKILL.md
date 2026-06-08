# 一键部署技能 (Deploy to Production)

## 触发条件
- "部署" "发布" "上线" "deploy"
- "部署到服务器" "推送到生产"
- "重新部署" "更新服务器"

## 服务器信息
| 字段 | 值 |
|------|-----|
| IP | 47.76.112.53 |
| 用户 | root |
| 认证 | SSH Key（`~/.ssh/id_rsa`） |
| 项目路径 | /opt/kaoshi |
| 前端部署 | /opt/kaoshi/dist (Nginx 静态托管) |
| 后端端口 | 3001 (PM2 管理) |
| Nginx 配置 | /etc/nginx/sites-available/kaoshi |

## 部署流程（6 步）

```
[1] 构建 → [2] 打包 → [3] 上传 → [4] 停旧 → [5] 部署 → [6] 验证
```

### 第1步：构建前端
```bash
cd D:\project\kaoshi && npm run build
```
- 输出目录：`dist/`
- 验证：确认 `dist/index.html` 存在

### 第2步：打包项目
```bash
cd D:\project\kaoshi && tar -czf deploy.tar.gz dist/ server/ public/ data/ package.json package-lock.json deploy/ecosystem.config.cjs deploy/nginx.conf --exclude=node_modules
```
- 排除 `node_modules`（在服务器上安装）
- 包含 `data/` 目录（保留用户数据）

### 第3步：上传到服务器
```bash
scp deploy.tar.gz root@47.76.112.53:/opt/kaoshi/
```

### 第4步：停止旧服务
```bash
ssh root@47.76.112.53 "
  pm2 stop all 2>/dev/null
  pm2 delete all 2>/dev/null
  # 备份用户数据（metrics.json / users.json / feedback.json 等）
  mkdir -p /opt/backup
  cp -r /opt/kaoshi/data/* /opt/backup/ 2>/dev/null || true
  rm -rf /opt/kaoshi/*
"
```

### 第5步：解压安装启动
```bash
ssh root@47.76.112.53 "
  cd /opt/kaoshi
  tar -xzf deploy.tar.gz && rm deploy.tar.gz
  cp -r /opt/backup/* /opt/kaoshi/data/ 2>/dev/null || true
  npm install --omit=dev

  # 写入 Nginx 配置
  cat > /etc/nginx/sites-available/kaoshi << 'NEOF'
server {
    listen 80;
    server_name _;
    root /opt/kaoshi/dist;
    index index.html;

    add_header X-Content-Type-Options 'nosniff' always;
    add_header X-Frame-Options 'SAMEORIGIN' always;
    add_header X-XSS-Protection '1; mode=block' always;
    add_header Referrer-Policy 'strict-origin-when-cross-origin' always;
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 256;

    location ~* \.(js|css|png|jpg|svg|ico)$ {
        expires 7d;
        add_header Cache-Control 'public, immutable';
    }
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    location /sw.js {
        expires -1;
        add_header Cache-Control 'no-cache';
    }
}
NEOF

  ln -sf /etc/nginx/sites-available/kaoshi /etc/nginx/sites-enabled/kaoshi
  nginx -t && nginx -s reload 2>/dev/null || nginx

  cd /opt/kaoshi && pm2 start deploy/ecosystem.config.cjs
  pm2 save
"
```

### 第6步：验证部署
```bash
# 外部可访问性
curl -s -o /dev/null -w 'HTTP %{http_code}' http://47.76.112.53/

# API 健康检查
curl -s http://47.76.112.53/api/health

# PM2 状态
ssh root@47.76.112.53 "pm2 list"
```

## 部署后检查清单
- [ ] HTTP 200（前端正常）
- [ ] `/api/health` 返回 `{"status":"ok",...}`
- [ ] PM2 状态 `online`，restarts=0
- [ ] Nginx 监听 80 端口
- [ ] 题库数据完整（subjects 列表正确）

## 回滚流程
如果部署失败，可快速回滚到旧版本：
```bash
# 旧版本文件通常在 /opt/backup/ 或 /opt/kaoshi/ 的 .tar.gz 快照中
ssh root@47.76.112.53 "
  pm2 stop all
  cd /opt/kaoshi && tar -xzf /opt/backup/last-good.tar.gz
  npm install --omit=dev
  pm2 start deploy/ecosystem.config.cjs
  nginx -s reload
"
```

## 注意事项
1. **首次部署需配置 SSH Key**：`ssh-copy-id root@47.76.112.53`（需密码）
2. **数据库备份**：每次部署自动备份 `/opt/kaoshi/data/` 到 `/opt/backup/`
3. **静态资源缓存**：assets 目录 7 天强缓存，代码变更会自动更新（Vite hash）
4. **零停机**：PM2 在 `npm install` 前已停止，安装完成后重新启动，中断时间 ≈ 安装时间
5. **monorepo 注意**：`miniapp/` 目录不需要部署到服务器

## 故障排查

| 问题 | 检查 | 修复 |
|------|------|------|
| 502 Bad Gateway | PM2 是否运行 | `pm2 restart zhikaotong-api` |
| 404 Not Found | Nginx root 路径 | 检查 `/opt/kaoshi/dist/` 是否存在 |
| API 无响应 | 端口是否一致 | Nginx `proxy_pass` 必须匹配 PM2 `API_PORT` |
| 题库为空 | data 目录 | 检查 `/opt/kaoshi/public/data/` 和 `/opt/kaoshi/data/` |
