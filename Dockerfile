# 使用輕量的 Node 鏡像
FROM node:18-slim

# 設定環境變量，避免 npm 安裝時下載多餘瀏覽器
ENV NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

# 安裝運行 Chromium 所需的最小系統依賴，並清理緩存以減小體積
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    && npx playwright-chromium install-deps chromium \
    && rm -rf /var/lib/apt/lists/*

# 先拷貝 package.json 並安裝依賴 (利用 Docker 緩存)
COPY package*.json ./
RUN npm ci --omit=dev

# 手動下載 Chromium 瀏覽器
RUN npx playwright install chromium

# 拷貝其餘源代碼
COPY . .

# 啟動應用
CMD ["node", "server.js"]
