#!/bin/bash
# 原子化部署 — 符号链接切换·零停机·自动回滚
set -e
TARGET="root@46.38.245.170"
REMOTE="/opt/manmanji"
RELEASE="release-$(date +%Y%m%d-%H%M%S)"
CURRENT="$REMOTE/current"

echo "🚀 原子部署 $RELEASE"

echo "=== 1. 本地构建+验证 ==="
cd "$(dirname "$0")/.."
rm -rf node_modules/.vite dist
npm run build 2>&1 | tail -2
test -f dist/index.html || { echo "❌ 构建失败"; exit 1; }
node tools/component-validator.js 2>&1 || { echo "❌ 组件契约违规"; exit 1; }
grep -q "generate-questions" dist/assets/index-*.js || { echo "❌ 构建缺少API"; exit 1; }
echo "✅ 本地验证通过"

echo "=== 2. 上传新版本 ==="
ssh $TARGET "mkdir -p $REMOTE/releases/$RELEASE"
rsync -avz --delete dist/ $TARGET:$REMOTE/releases/$RELEASE/ 2>&1 | tail -3
rsync -avz --delete server/ $TARGET:$REMOTE/server/ 2>&1 | tail -3

echo "=== 3. 验证远程文件 ==="
ssh $TARGET "test -f $REMOTE/releases/$RELEASE/index.html && test -d $REMOTE/releases/$RELEASE/assets" || { echo "❌ 远程文件不完整"; exit 1; }

echo "=== 4. 备份当前版本 ==="
ssh $TARGET "if [ -L $CURRENT ]; then OLD=\$(readlink $CURRENT); cp -r \$OLD $REMOTE/backups/\$(basename \$OLD) 2>/dev/null; fi"

echo "=== 5. 原子切换 ==="
ssh $TARGET "ln -sfn $REMOTE/releases/$RELEASE $CURRENT.tmp && mv -Tf $CURRENT.tmp $CURRENT"
echo "✅ 切换完成 → $RELEASE"

echo "=== 6. 重启服务 ==="
ssh $TARGET "cd $REMOTE && pm2 restart manmanji-api && nginx -s reload"
sleep 2

echo "=== 7. 冒烟测试 ==="
if curl -sf -o /dev/null http://46.38.245.170:3010/api/health; then
  echo "✅ 部署成功"
else
  echo "❌ 部署失败，回滚..."
  ssh $TARGET "if [ -d $REMOTE/backups ]; then PREV=\$(ls -t $REMOTE/backups | head -1); ln -sfn $REMOTE/backups/\$PREV $CURRENT && pm2 restart manmanji-api; echo '已回滚到 '\$PREV; fi"
  exit 1
fi

echo "=== 8. 清理旧版本(保留最近3个) ==="
ssh $TARGET "cd $REMOTE/releases && ls -t | tail -n +4 | xargs -r rm -rf"

echo ""
echo "🎉 部署完成: $RELEASE"
echo "   当前: $CURRENT → releases/$RELEASE"
echo "   访问: http://46.38.245.170:3010"
