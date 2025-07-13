FROM oven/bun:1 AS base
WORKDIR /api

# Install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Copy your app code
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

USER bun
EXPOSE 8020
ENTRYPOINT [ "bun", "run", "start" ]