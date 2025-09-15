FROM node:22.18.0-alpine@sha256:1b2479dd35a99687d6638f5976fd235e26c5b37e8122f786fcd5fe231d63de5b AS builder

ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--max_old_space_size=4096

WORKDIR /build

# Copy only dependency files first for better caching
COPY package*.json .npmrc ./

# Install dependencies in a separate layer that's cached unless dependencies change
RUN --mount=type=cache,target=/root/.npm \
    npm ci --verbose

# Copy build configuration files (these change less frequently than source)
COPY tsconfig.json vite.config.ts index.html ./

# Copy public assets (usually static)
COPY public/ ./public/

# Copy source code last (changes most frequently)
COPY src/ ./src/

# Build the application with cache mount for faster rebuilds
RUN --mount=type=cache,target=/build/node_modules/.vite \
    npm run build

FROM registry.access.redhat.com/ubi9/nginx-124:9.6-1756959211@sha256:126903359331eb9f2c87950f952442db456750190956b9301d00acfcadbc19ed

# Copy built web application
COPY --from=builder /build/dist ./

ARG IMAGE_CREATED="unknown"
ARG IMAGE_REVISION="unknown"
ARG IMAGE_VERSION="unknown"
LABEL org.opencontainers.image.authors='Landeshauptstadt München <opensource@muenchen.de>' \
    org.opencontainers.image.vendor='Landeshauptstadt München' \
    org.opencontainers.image.created="$IMAGE_CREATED" \
    org.opencontainers.image.revision="$IMAGE_REVISION" \
    org.opencontainers.image.version="$IMAGE_VERSION" \
    org.opencontainers.image.url='ghcr.io/it-at-m/mucgpt/mucgpt-frontend' \
    org.opencontainers.image.documentation='https://github.com/it-at-m/mucgpt/blob/main/README.md' \
    org.opencontainers.image.source='https://github.com/it-at-m/mucgpt' \
    org.opencontainers.image.licenses='MIT' \
    org.opencontainers.image.title='mucgpt-frontend' \
    org.opencontainers.image.description="The frontend for MUCGPT. Provides a web interface for interacting with the MUCGPT backend services."


# Copy custom nginx configurations
COPY docker/nginx/*.conf "${NGINX_DEFAULT_CONF_PATH}"

CMD nginx -g "daemon off;"
