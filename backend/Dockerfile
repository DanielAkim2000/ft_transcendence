# Base partagee entre les etapes du build.
FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Installation a partir du lockfile : pas de node_modules local copie.
FROM base AS deps

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# Prisma et la compilation du backend se font dans cette etape.
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm exec prisma generate
RUN pnpm run build

# Image finale : on recupere le build et les fichiers utiles au lancement.
FROM base AS runner

ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig.json /app/tsconfig.seed.json ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh

EXPOSE 5000

# L'entrypoint charge les secrets, applique Prisma, puis lance la commande.
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
