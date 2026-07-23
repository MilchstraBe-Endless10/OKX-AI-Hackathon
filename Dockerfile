FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@11.15.1 --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/ packages/contracts/
COPY packages/core/ packages/core/
COPY apps/server/ apps/server/

RUN pnpm install --frozen-lockfile

RUN cd apps/server && pnpm build

FROM node:22-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=base /app/apps/server/dist ./apps/server/dist
COPY --from=base /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=base /app/apps/server/package.json ./apps/server/package.json
COPY --from=base /app/packages/contracts ./packages/contracts
COPY --from=base /app/packages/core ./packages/core
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/pnpm-workspace.yaml ./pnpm-workspace.yaml

EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
