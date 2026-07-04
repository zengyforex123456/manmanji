#!/bin/sh
echo "🚀 极简智考启动..."
mkdir -p /app/data
nginx
echo "✅ Nginx (port 80)"
cd /app && node server/index.js
