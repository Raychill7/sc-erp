# 前端构建
FROM node:20-alpine AS client-build
WORKDIR /build
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client ./client
RUN cd client && npm run build

# 运行：API + 可选静态站点（public/）
FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server ./
COPY database ./database
COPY --from=client-build /build/client/dist ./public
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
