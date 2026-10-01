# Self-hosted trade journal — single container, SQLite on a Railway volume.
FROM node:22-slim AS builder
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY apps/web ./apps/web
COPY tsconfig.base.json ./
RUN pnpm --filter web build

FROM node:22-slim AS runner
ENV NODE_ENV=production
ENV JOURNAL_DATA_DIR=/data
WORKDIR /app
COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public
RUN mkdir -p /data && chown -R node:node /data /app
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
# Railway mounts the persistent volume after the image is built, so /data can
# arrive root-owned at runtime. Start as root so SQLite can create its DB there.
CMD ["node", "apps/web/server.js"]
