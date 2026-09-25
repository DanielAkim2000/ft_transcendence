FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm run build

FROM nginx:1.27-alpine AS runner

RUN apk add --no-cache openssl

ENV NGINX_ENVSUBST_FILTER="^(HTTPS_PORT|BACKEND_PORT)$" \
    HTTPS_PORT=8443 \
    BACKEND_PORT=5000

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.d-generate-cert.sh /docker-entrypoint.d/40-generate-cert.sh
RUN chmod +x /docker-entrypoint.d/40-generate-cert.sh
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
