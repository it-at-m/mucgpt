FROM node:22.17.1-alpine@sha256:5539840ce9d013fa13e3b9814c9353024be7ac75aca5db6d039504a56c04ea59 AS builder

ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--max_old_space_size=4096

WORKDIR /build
# Just copy necessary data to build frontend
COPY package*.json .npmrc tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/

RUN npm ci --verbose
RUN npm run build

# For documentation see https://github.com/sclorg/nginx-container
FROM registry.access.redhat.com/ubi9/nginx-124:9.6-1754406834@sha256:5a3130f72a6b50d77cb2642028ebac8acf420647887ddee7ccd1eedc2b02d69b

# Copy built web application
COPY --from=builder /build/dist ./

# Copy custom nginx configurations
COPY docker/nginx/*.conf "${NGINX_DEFAULT_CONF_PATH}"

# Start the web server
CMD nginx -g "daemon off;"
