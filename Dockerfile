FROM node:22-alpine AS build

COPY . /app
WORKDIR /app
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
RUN corepack enable pnpm && pnpm config set registry https://registry.npmmirror.com/ && \
    cd /app && pnpm install && pnpm build && \
    mv /app/dist /dist && \
    rm -rf /app

FROM caddy:2.9-alpine

COPY --from=build /dist /srv
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
EXPOSE 443