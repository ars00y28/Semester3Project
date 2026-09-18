FROM node:20-slim AS base

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

RUN mkdir -p /data

ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.mjs"]