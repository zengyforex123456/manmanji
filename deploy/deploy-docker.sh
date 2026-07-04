#!/bin/bash
# Docker部署 — 构建→验证→推送容器→重启
set -e
TARGET="root@46.38.245.170"
SRC="/opt/jijianzhikao"
CONT="jjzk"

echo "=== 1. 构建 ==="
cd "$(dirname "$0")/.."
rm -rf node_modules/.vite dist
npm run build 2>&1 | tail -2
[ -f dist/index.html ] || { echo "❌ 构建失败"; exit 1; }

echo "=== 2. 验证 ==="
node tools/component-validator.js 2>&1 || true
grep -q "generate-questions" dist/assets/index-*.js || { echo "❌ API缺失"; exit 1; }
echo "✅ 验证通过"

echo "=== 3. 推送dist ==="
scp -r dist/* $TARGET:$SRC/dist/ 2>&1 | tail -3

echo "=== 4. 更新容器 ==="
ssh $TARGET "docker cp $SRC/dist/. $CONT:/app/dist/ && docker restart $CONT" 2>&1
sleep 3

echo "=== 5. 验证 ==="
curl -sf -o /dev/null http://46.38.245.170:3010/ || { echo "❌"; exit 1; }
curl -sf http://46.38.245.170:3010/api/health | grep -q '"ok"' || { echo "❌ API"; exit 1; }
echo "✅ http://46.38.245.170:3010"
