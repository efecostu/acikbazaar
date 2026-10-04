# AçıkBazaar ajan worker'ı. Build context = repo kökü (worker/deploy.sh gönderir).
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm install --no-save tsx@4 && npm cache clean --force
COPY tsconfig.json ./
COPY types ./types
COPY lib ./lib
COPY worker ./worker
USER node
CMD ["npx", "tsx", "worker/index.ts"]
