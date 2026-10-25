# Etapa 1: compila TypeScript e instala dependências nativas (better-sqlite3)
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# Etapa 2: imagem final enxuta, sem ferramentas de build
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN mkdir -p data && chown -R node:node /app
USER node
EXPOSE 3333
CMD ["node", "dist/server.js"]
