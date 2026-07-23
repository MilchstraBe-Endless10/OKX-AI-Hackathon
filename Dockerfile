FROM node:22-slim
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.15.1 --activate

WORKDIR /app

# Copy workspace config first
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/contracts/src packages/contracts/src
COPY packages/contracts/tsconfig.json packages/contracts/
COPY packages/core/src packages/core/src
COPY packages/core/tsconfig.json packages/core/
COPY apps/server/src apps/server/src
COPY apps/server/tsconfig.json apps/server/

# Build server
RUN pnpm --filter @sopscape/server build

EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
