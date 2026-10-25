FROM node:22.22.1-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production \
    APP_MODE=cloud \
    PORT=10000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --chown=node:node . .
USER node

EXPOSE 10000
CMD ["node", "server.mjs"]
