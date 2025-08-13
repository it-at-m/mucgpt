FROM node:22.17.1-alpine@sha256:5539840ce9d013fa13e3b9814c9353024be7ac75aca5db6d039504a56c04ea59 AS builder

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

FROM registry.access.redhat.com/ubi9/nginx-124:9.6-1753698567@sha256:227db579eef86549aab1395e012e8f04eb352e8ba6f4b29601c84d1585e2c4e4

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
    org.opencontainers.image.url='https://github.com/it-at-m/mucgpt/pkgs/container/mucgpt-frontend' \
    org.opencontainers.image.documentation='https://github.com/it-at-m/mucgpt/blob/main/README.md' \
    org.opencontainers.image.source='https://github.com/it-at-m/mucgpt' \
    org.opencontainers.image.licenses='MIT' \
    org.opencontainers.image.title='mucgpt-frontend' \
    org.opencontainers.image.description="The frontend for MUCGPT. Provides a web interface for interacting with the MUCGPT backend services."


# Copy custom nginx configurations
COPY docker/nginx/*.conf "${NGINX_DEFAULT_CONF_PATH}"

CMD nginx -g "daemon off;"
