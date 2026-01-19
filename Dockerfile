# 使用輕量的 Node 鏡像
FROM node:18-slim

# 設定環境變量
# PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 這裡不要跳過，因為我們要在 Docker 內安裝
ENV NODE_ENV=production \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 安裝運行 Chromium 所需的最小系統依賴
# 增加 procps 用於進程管理
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    procps \
    dumb-init \
    && npx playwright-chromium install-deps chromium \
    && rm -rf /var/lib/apt/lists/*

# 先拷貝 package.json 並安裝依賴
COPY package*.json ./
RUN npm ci --omit=dev

# 安裝 Chromium
RUN npx playwright install chromium

# 只拷貝運行所需的源代碼
COPY *.js ./

# 增加啟動腳本以處理信號
# 使用 node 直接啟動也是可以的，但在 Docker 中有時需要 init
# CMD ["node", "server.js"]
# 為了穩定性，我們可以使用 --init
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "server.js"]
