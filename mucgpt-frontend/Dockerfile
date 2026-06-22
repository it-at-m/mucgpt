FROM node:24.17.0-alpine@sha256:156b55f92e98ccd5ef49578a8cea0df4679826564bad1c9d4ef04462b9f0ded6 AS builder

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--max_old_space_size=4096
ENV VITE_DISABLE_PWA=true
#ENV ONNXRUNTIME_NODE_INSTALL=skip
ENV HTTP_PROXY=${HTTP_PROXY}
ENV http_proxy=${HTTP_PROXY}
ENV HTTPS_PROXY=${HTTPS_PROXY}
ENV https_proxy=${HTTPS_PROXY}
ENV NO_PROXY=${NO_PROXY}
ENV no_proxy=${NO_PROXY}
ENV GLOBAL_AGENT_HTTP_PROXY=${HTTP_PROXY}
ENV GLOBAL_AGENT_HTTPS_PROXY=${HTTPS_PROXY}

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

FROM registry.access.redhat.com/ubi9/nginx-124:9.8-1781729662@sha256:fc282f9fc249d9b9606d1d93769e1b6e1c042221fdae285b53032b59ba9690d0

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
