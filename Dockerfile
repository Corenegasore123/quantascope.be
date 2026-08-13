FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/calculation-engine/package.json ./packages/calculation-engine/

RUN npm ci --ignore-scripts

COPY packages/calculation-engine ./packages/calculation-engine
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./

RUN npm run build --workspace=packages/calculation-engine
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S quantscope && adduser -S quantscope -G quantscope

COPY package.json package-lock.json* ./
COPY packages/calculation-engine/package.json ./packages/calculation-engine/
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/packages/calculation-engine/dist ./packages/calculation-engine/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY scripts ./scripts

RUN mkdir -p storage && chown -R quantscope:quantscope /app

USER quantscope

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

CMD ["node", "dist/index.js"]
