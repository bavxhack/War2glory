FROM node:24-alpine AS frontend-builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY apps ./apps
RUN npm run build

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --chown=node:node package.json ./
COPY --chown=node:node apps ./apps
COPY --chown=node:node packages ./packages
COPY --from=frontend-builder --chown=node:node /app/apps/client/dist ./apps/client/dist
RUN mkdir -p /app/data && chown node:node /app/data

USER node
EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(response => { if (!response.ok) process.exit(1) }).catch(() => process.exit(1))"]

ENTRYPOINT ["node", "apps/server/index.js"]
CMD ["--world", "alpha", "--port", "3000", "--host", "0.0.0.0"]
