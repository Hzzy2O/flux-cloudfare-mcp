FROM node:22.12-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY src/ ./src/

RUN --mount=type=cache,target=/root/.npm npm install
RUN npm run build

FROM node:22.12-alpine AS release

WORKDIR /app

COPY --from=builder /app/build /app/build
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./

ENV NODE_ENV=production

RUN npm ci --ignore-scripts --omit-dev

CMD ["node", "build/index.js"]
