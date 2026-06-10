# Multi-stage build for the Orbital simulation website
# 1) Install workspace dependencies and build the client
# 2) Copy only runtime artifacts into a smaller production image

FROM node:20-bullseye AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY website/server/package.json ./website/server/
COPY website/client/package.json website/client/package-lock.json ./website/client/
COPY packages/bus/package.json packages/bus/
COPY packages/utils/package.json packages/utils/
COPY packages/agents/package.json packages/agents/
COPY viz/package.json viz/

RUN npm install --include=dev

FROM node:20-bullseye AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build viz first (outputs to public/assets/viz/), then build the Svelte client
RUN cd viz && npm run build
RUN cd website/client && npm install --legacy-peer-deps && npm run build

FROM node:20-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY website/server/package.json ./website/server/
COPY packages/bus/package.json packages/bus/
COPY packages/utils/package.json packages/utils/
COPY packages/agents/package.json packages/agents/
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/website/server ./website/server

RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "--env-file=website/server/.env", "website/server/index.js"]
