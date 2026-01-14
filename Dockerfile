FROM mcr.microsoft.com/playwright:v1.48.2-jammy

WORKDIR /app

# 只安裝正式依賴，避免額外體積與背景進程。
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

# Railway 會注入 PORT，這裡不硬編碼。
CMD ["npm", "start"]

