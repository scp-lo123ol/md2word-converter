# 生产镜像 - 自动安装所有依赖
FROM node:20-alpine AS production

WORKDIR /app/backend

# 安装 Chromium 和其他运行依赖（从网络自动安装）
RUN apk add --no-cache \
    chromium \
    chromium-headless-shell \
    font-noto-cjk \
    font-freefont \
    ttf-dejavu \
    wget \
    && rm -rf /var/cache/apk/*

# 设置 Chromium 环境变量
ENV CHROMIUM_PATH=/usr/bin/chromium-headless-shell
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# 下载 Pandoc（Linux x86_64 版本）
RUN wget -q https://github.com/jgm/pandoc/releases/download/3.1.11/pandoc-3.1.11-linux-amd64.tar.gz \
    && tar -xzf pandoc-3.1.11-linux-amd64.tar.gz \
    && mv pandoc-3.1.11-linux-amd64/pandoc /usr/local/bin/pandoc \
    && chmod +x /usr/local/bin/pandoc \
    && rm -rf pandoc-3.1.11-linux-amd64*

# 复制 node_modules（从本地构建）
COPY backend/node_modules ./node_modules

# 复制后端构建产物（已包含 templates）
COPY backend/dist ./dist

# 复制前端构建产物
COPY frontend/dist ../frontend/dist

# 暴露端口
EXPOSE 3001

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3001
ENV PANDOC_PATH=/usr/local/bin/pandoc
ENV MERMAID_RENDER_MODE=local

# 启动服务
CMD ["node", "dist/index.js"]