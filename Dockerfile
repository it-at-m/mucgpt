# Stage 1: Builder
FROM node:22.12.0-alpine@sha256:6e80991f69cc7722c561e5d14d5e72ab47c0d6b6cfb3ae50fb9cf9a7b30fdf97 AS builder

ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--max_old_space_size=4096

WORKDIR /build

# Just copy necessary data to build frontend
COPY app/frontend/package*.json ./
RUN npm ci --verbose
COPY app/frontend/ ./
RUN npm run build

# Stage 2: python build
FROM python:3.12-slim@sha256:2b0079146a74e23bf4ae8f6a28e1b484c6292f6fb904cbb51825b4a19812fcd8 AS python-builder
COPY --from=ghcr.io/astral-sh/uv:latest@sha256:0bc959d4cc56e42cbd9aa9b63374d84481ee96c32803eea30bd7f16fd99d8d56 /uv /bin/uv

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
