# Imagem única do Prumo: Node + Chromium, para rodar igual na máquina e no CI.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig*.json ./
COPY packages ./packages
COPY apps/cli ./apps/cli
RUN npm ci && npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-dejavu-core git \
 && rm -rf /var/lib/apt/lists/*
ENV PRUMO_CHROMIUM=/usr/bin/chromium
WORKDIR /app
COPY --from=build /app /app
RUN ln -s /app/apps/cli/dist/main.js /usr/local/bin/prumo && chmod +x /app/apps/cli/dist/main.js
USER node
WORKDIR /docs
HEALTHCHECK NONE
ENTRYPOINT ["prumo"]
CMD ["--help"]
