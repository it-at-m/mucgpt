# Stage 1: Builder
FROM node:22-alpine AS builder

ENV GENERATE_SOURCEMAP=false
ENV NODE_OPTIONS=--max_old_space_size=4096

WORKDIR /build

# Just copy necessary data to build frontend
COPY app/frontend/package*.json ./
RUN npm install
COPY app/frontend/ ./
RUN npm run build

# Stage 2: python build
FROM python:3.12-slim  AS python-builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

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

RUN echo "MUCGPT_VERSION=${VERSION}" >> .env && \
    echo "MUCGPT_COMMIT=${COMMIT}" >> .env
# insert frontend build
COPY --from=builder /build/dist/ /code/static/

# sync the project
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen

EXPOSE 8000
CMD ["uv", "run", "gunicorn", "app:backend"]
