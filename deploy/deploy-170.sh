#!/bin/bash
# 慢慢记 一键部署到170服务器 (neijuan.info)
TARGET="root@46.38.245.170"
REMOTE="/opt/manmanji"
DOMAIN="neijuan.info"
API_PORT=3011

echo "=== 1. 构建前端 ==="
cd "$(dirname "$0")/.."
npm install --production=false 2>&1 | tail -2
npm run build 2>&1 | tail -5

echo "=== 2. 打包 ==="
tar -czf /tmp/manmanji.tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  --exclude=test-results \
  --exclude=coverage \
  dist/ server/ public/data/ data/ package.json deploy/ecosystem.config.cjs 2>&1

echo "=== 3. 上传到170 ==="
scp /tmp/manmanji.tar.gz $TARGET:/tmp/

echo "=== 4. 解压部署 ==="
ssh $TARGET "mkdir -p $REMOTE && cd $REMOTE && tar -xzf /tmp/manmanji.tar.gz && npm install --production 2>&1 | tail -3"

echo "=== 5. 配置Nginx (IP直连, 端口3010) ==="
ssh $TARGET "cat > /etc/nginx/sites-available/manmanji << 'NGINX'
server {
    listen 3010;
    server_name _;

    root $REMOTE/dist;
    index index.html;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 256;

    location / {
        try_files \\\$uri \\\$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3011;
        proxy_http_version 1.1;
        proxy_set_header Host \\\$host;
        proxy_set_header X-Real-IP \\\$remote_addr;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/manmanji /etc/nginx/sites-enabled/
nginx -t && nginx -s reload"

echo "=== 6. 重启API ==="
ssh $TARGET "cd $REMOTE && pm2 reload ecosystem.config.cjs 2>/dev/null || pm2 start deploy/ecosystem.config.cjs && pm2 save"

echo "=== 7. 验证 ==="
sleep 2
echo "--- 前端 ---"
curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/ && echo ""
echo "--- API健康检查 ---"
curl -s http://$DOMAIN/api/health || curl -s http://46.38.245.170:$API_PORT/api/health
echo ""
echo "--- 支付接口测试 ---"
curl -s http://46.38.245.170:$API_PORT/api/payments/products
echo ""
echo "✅ 部署完成！访问 http://$DOMAIN"
