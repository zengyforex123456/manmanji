#!/bin/bash
# 安全部署脚本 — 构建→验证→清旧→部署→测试
set -e  # 任何步骤失败即停
TARGET="root@46.38.245.170"
REMOTE="/opt/manmanji"

echo "=== 0. 本地语法检查 ==="
# 检查关键源文件语法
for f in src/main.js src/api.js src/components/login.js src/services/ai-question-generator.js; do
  if ! node --check "$f" 2>/dev/null; then
    echo "❌ 语法错误: $f"
    node --check "$f" 2>&1 | head -5
    exit 1
  fi
done
echo "✅ 语法检查通过"

echo "=== 1. 清理缓存 ==="
cd "$(dirname "$0")/.."
rm -rf node_modules/.vite dist

echo "=== 2. 构建 ==="
npm run build 2>&1 | tail -5
if [ ! -f dist/index.html ]; then echo "❌ 构建失败: dist/index.html 不存在"; exit 1; fi
echo "✅ 构建成功"

echo "=== 3. 验证关键API在构建中 ==="
if ! grep -q "generate-questions" dist/assets/index-*.js; then
  echo "❌ 构建缺少 generate-questions API"
  exit 1
fi
if ! grep -q "startAIQuick" dist/assets/index-*.js; then
  echo "❌ 构建缺少 startAIQuick"
  exit 1
fi
echo "✅ API验证通过"

echo "=== 4. 保存SPA ==="
cp dist/index.html dist/index-vite.html

echo "=== 5. 清空服务器旧文件 ==="
ssh $TARGET "rm -rf $REMOTE/dist/assets $REMOTE/dist/index*.js $REMOTE/dist/index-vite.html $REMOTE/dist/index.html $REMOTE/dist/app" 2>/dev/null

echo "=== 5b. 组件契约验证 ==="
node tools/component-validator.js 2>&1 || { echo "❌ 组件契约违规"; exit 1; }

echo "=== 5c. 验证服务端语法 ==="
node --check server/index.js 2>&1 && echo "✅ server/index.js OK" || { echo "❌ server/index.js 语法错误"; exit 1; }
# 检查整个server目录
for f in server/*.js; do
  node --check "$f" 2>/dev/null || { echo "⚠️  $f 语法需检查"; }
done

echo "=== 6. 原子化上传 ==="
# rsync --delete: 目标目录与源目录完全一致, 旧文件自动删除
rsync -avz --delete server/ $TARGET:$REMOTE/server/ 2>&1 | tail -3
rsync -avz --delete dist/ $TARGET:$REMOTE/dist/ 2>&1 | tail -3

echo "=== 7. 部署Landing ==="
scp landing.html $TARGET:$REMOTE/dist/index.html 2>&1 | tail -1

echo "=== 8. 重载服务 ==="
ssh $TARGET "nginx -s reload && cd $REMOTE && pm2 restart manmanji-api" 2>&1 | tail -3
sleep 2

echo "=== 9. 注入版本号 ==="
VER=$(date +%Y%m%d-%H%M%S)
ssh $TARGET "sed -i 's/<meta charset/<meta data-ver=\"$VER\" charset/' $REMOTE/dist/index.html"
echo "📌 版本: $VER"

echo "=== 10. 禁用缓存 ==="
ssh $TARGET "cat > /etc/nginx/sites-available/manmanji << 'EOF'
server {
    listen 3010; server_name _;
    root /opt/manmanji/dist; index index.html;
    gzip on; gzip_types text/css application/javascript application/json image/svg+xml; gzip_min_length 256;
    location /assets/ { expires -1; add_header Cache-Control 'no-cache, must-revalidate'; }
    location / { try_files \\\$uri \\\$uri/ /index.html; expires -1; add_header Cache-Control 'no-cache'; }
    location /api/ { proxy_pass http://127.0.0.1:3011; proxy_http_version 1.1; proxy_set_header Host \\\$host; }
}
EOF
nginx -t && nginx -s reload"

echo "=== 11. 冒烟测试 ==="
if ! curl -sf -o /dev/null http://46.38.245.170:3010/; then echo "❌ Landing不可达"; exit 1; fi
if ! curl -sf -o /dev/null http://46.38.245.170:3010/app; then echo "❌ App不可达"; exit 1; fi
if ! curl -sf http://46.38.245.170:3010/api/health | grep -q '"ok"'; then echo "❌ API异常"; exit 1; fi

echo ""
echo "✅ 部署完成 · 全部验证通过"
echo "   Landing: http://46.38.245.170:3010/"
echo "   App:     http://46.38.245.170:3010/app"
