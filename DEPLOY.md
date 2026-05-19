# Markdown 转 Word 部署手册

## 快速部署（推荐）

### 前置要求

- Docker & Docker Compose
- 服务器能访问外网（用于下载 Pandoc 和 Chromium）

### 一键部署

```bash
# 克隆项目
git clone https://github.com/scp-lo123ol/md2word-converter.git
cd md2word-converter

# 构建并启动
docker compose up -d --build
```

访问 `http://localhost:3001`（或配置的端口）

---

## 详细部署步骤

### 1. 本地构建

#### 1.1 后端构建

```bash
cd backend
npm install
npm run build

# 生成生产依赖
rm -rf node_modules
npm install --omit=dev
```

#### 1.2 前端构建

```bash
cd frontend
npm install
npm run build
```

### 2. Docker 部署

```bash
# 构建镜像（自动安装 Chromium 和 Pandoc）
docker compose build

# 启动服务
docker compose up -d

# 查看日志
docker logs md2word-1 -f
```

---

## 环境变量配置

在 `docker-compose.yml` 中修改：

```yaml
environment:
  - NODE_ENV=production
  - PORT=3001
  - PANDOC_PATH=/usr/local/bin/pandoc
  - MERMAID_RENDER_MODE=local  # local 或 remote
  - MERMAID_RENDER_URL=        # 仅 remote 模式需要
```

端口映射：

```yaml
ports:
  - "14000:3001"  # 外部端口:内部端口
```

---

## 无外网服务器部署

如果服务器无法访问外网，需要提前准备基础镜像：

### 3.1 导出基础镜像（有网络的机器）

```bash
# 拉取并导出 Node.js 镜像
docker pull node:20-alpine
docker save node:20-alpine | gzip > node-20-alpine.tar.gz
```

### 3.2 上传并加载镜像

```bash
# 在服务器上加载
docker load -i node-20-alpine.tar.gz
```

### 3.3 修改 Dockerfile

将 Dockerfile 中的 `apk add` 和 `wget` 命令注释掉，改为复制本地预置文件：

```dockerfile
# 复制本地预置的 APK 包（离线安装）
COPY backend/apk/*.apk /tmp/apk/
RUN apk add --no-cache --allow-untrusted /tmp/apk/*.apk && rm -rf /tmp/apk

# 复制本地预置的 Pandoc
COPY backend/bin/pandoc /usr/local/bin/pandoc
RUN chmod +x /usr/local/bin/pandoc
```

然后打包 `backend/apk/` 和 `backend/bin/` 目录一起上传。

---

## 常见问题

### Q1: Pandoc 下载失败

**原因**：无法访问 GitHub Releases  
**解决**：手动下载 Pandoc Linux 版本，放入 `backend/bin/pandoc`

### Q2: Chromium 安装失败

**原因**：无法访问 Alpine 包仓库  
**解决**：提前下载 APK 包放入 `backend/apk/`

### Q3: 前端报错连接 localhost:3001

**原因**：前端未使用生产环境配置构建  
**解决**：确保 `frontend/.env.production` 内容为 `VITE_API_BASE=/api`

### Q4: Mermaid 渲染失败

**原因**：Chromium 未正确安装  
**解决**：检查 `docker exec -it md2word-1 chromium-browser --version`

---

## 快速命令参考

```bash
# 查看容器状态
docker ps

# 查看日志
docker logs md2word-1 -f

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 重新构建并启动
docker compose up -d --build --force-recreate

# 进入容器调试
docker exec -it md2word-1 sh

# 测试 Pandoc
docker exec -it md2word-1 /usr/local/bin/pandoc --version

# 测试 Chromium
docker exec -it md2word-1 chromium-browser --version
```

---

## 目录结构

```
md2word-converter/
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── backend/
│   ├── dist/                 # 后端编译代码
│   ├── node_modules/         # 生产依赖
│   └── src/
│       └── templates/        # Pandoc 模板
│           ├── custom-table.lua
│           ├── reference.docx
│           └── mermaid.min.js
└── frontend/
    └── dist/                 # 前端编译代码
```

> 注：`backend/apk/` 和 `backend/bin/` 仅用于无外网部署，已加入 `.gitignore`