FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 4000
CMD ["npx", "tsx", "src/main.ts"]
