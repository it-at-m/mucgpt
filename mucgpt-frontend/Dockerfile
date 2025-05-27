FROM node:22.16.0-alpine@sha256:9f3ae04faa4d2188825803bf890792f33cc39033c9241fc6bb201149470436ca AS builder

ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--max_old_space_size=4096

WORKDIR /build
# Just copy necessary data to build frontend
COPY package*.json .npmrc tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/

RUN npm ci --verbose
RUN npm run build

# For documentation see https://github.com/sclorg/nginx-container
FROM registry.access.redhat.com/ubi9/nginx-124:9.6-1747641899@sha256:8f3028866a8e2d8fafea39b0fc49f523a46ec645d11507c2a04bedf93c79142d

# Copy built web application
COPY --from=builder /build/dist ./

# Copy custom nginx configurations
COPY docker/nginx/*.conf "${NGINX_DEFAULT_CONF_PATH}"

# Start the web server
CMD nginx -g "daemon off;"
