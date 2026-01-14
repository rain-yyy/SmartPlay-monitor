# 使用轻量的 Node 镜像
FROM node:18-slim

# 设置工作目录
WORKDIR /app

# 安装 Chromium 运行所需的系统依赖 (仅 Chromium 所需)
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && npx playwright install-deps chromium \
    && rm -rf /var/lib/apt/lists/*

# 先拷贝 package.json 并安装依赖 (利用缓存)
COPY package*.json ./
RUN npm ci --omit=dev

# 仅下载 Chromium 浏览器
RUN npx playwright install chromium

# 拷贝源代码
COPY . .

ENV NODE_ENV=production

# Cloud Run 默认使用 PORT 环境变量
CMD ["node", "server.js"]