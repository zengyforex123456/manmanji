# 极简智考 Docker 部署
# 构建: docker build -t jijianzhikao .
# 运行: docker run -d -p 3010:80 --name jijianzhikao jijianzhikao
# 更新: docker build -t jijianzhikao . && docker stop jijianzhikao && docker rm jijianzhikao && docker run -d -p 3010:80 --name jijianzhikao jijianzhikao

# ═══ 阶段1: 构建 ═══
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# 验证构建
RUN test -f dist/index.html || (echo "Build failed" && exit 1)
RUN test -d dist/assets || (echo "Assets missing" && exit 1)

# ═══ 阶段2: 运行 ═══
FROM node:18-alpine
WORKDIR /app

# Nginx for static files
RUN apk add --no-cache nginx

# 复制构建产物
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/server /app/server
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/

# Nginx 配置
COPY nginx-docker.conf /etc/nginx/http.d/default.conf

# 启动脚本
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
