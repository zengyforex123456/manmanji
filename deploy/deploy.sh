#!/bin/bash
# 职考通一键部署脚本
# 使用: bash deploy/deploy.sh

set -e
echo "🚀 职考通部署开始..."

# 1. 构建前端
echo "📦 构建前端..."
npm install --production=false
npm run build

# 2. 复制到部署目录
DEPLOY_DIR="/var/www/zhikaotong"
echo "📁 复制文件到 $DEPLOY_DIR..."
sudo mkdir -p $DEPLOY_DIR
sudo cp -r dist/* $DEPLOY_DIR/
sudo cp -r public/data $DEPLOY_DIR/

# 3. 安装后端依赖
echo "📦 安装 API 依赖..."
npm install --production

# 4. 重启 API 服务
echo "🔄 重启 API..."
pm2 reload deploy/ecosystem.config.cjs || pm2 start deploy/ecosystem.config.cjs
pm2 save

# 5. 重载 Nginx
echo "🔧 重载 Nginx..."
sudo cp deploy/nginx.conf /etc/nginx/sites-available/zhikaotong
sudo ln -sf /etc/nginx/sites-available/zhikaotong /etc/nginx/sites-enabled/
sudo nginx -t && sudo nginx -s reload

echo "✅ 部署完成！访问 https://zhikaotong.com"
