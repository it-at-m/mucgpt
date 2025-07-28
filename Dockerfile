# Stage 1: Builder
FROM node:22.17.1-alpine@sha256:5539840ce9d013fa13e3b9814c9353024be7ac75aca5db6d039504a56c04ea59 AS builder

ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--max_old_space_size=4096

WORKDIR /build

# Just copy necessary data to build frontend
COPY app/frontend/package*.json ./
RUN npm ci --verbose
COPY app/frontend/ ./
RUN npm run build

# Stage 2: python build
FROM python:3.12-slim@sha256:34656cd90456349040784165b9decccbcee4de66f3ead0a1168ba893455afd1e  AS python-builder
COPY --from=ghcr.io/astral-sh/uv:latest@sha256:ef11ed817e6a5385c02cd49fdcc99c23d02426088252a8eace6b6e6a2a511f36 /uv /bin/uv

WORKDIR /code

# copy uv version infos
COPY uv.lock .
COPY pyproject.toml .

# Install dependencies
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project

# copy data from builder and backend srcs
COPY app/backend .

# add version information during build time and save it to an .env file
ARG COMMIT
ARG VERSION

ENV MUCGPT_VERSION=${VERSION}
ENV MUCGPT_COMMIT=${COMMIT}
# insert frontend build
COPY --from=builder /build/dist/ /code/static/

# sync the project
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen

EXPOSE 8000
CMD ["uv", "run", "gunicorn", "app:backend"]
