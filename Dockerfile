FROM node:22-slim
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.15.1 --activate

WORKDIR /app

# Copy everything
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build all packages
RUN pnpm build

EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
