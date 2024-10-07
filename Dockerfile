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

# Stage 2: Final Image
FROM python:3.12 AS python-builder

WORKDIR /code

# install python dependencies
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv
COPY app/backend/requirements.txt .
RUN uv pip install --no-cache-dir -r requirements.txt  --system --compile-bytecode

# copy data from builder and backend srcs
COPY app/backend .
COPY --from=builder /build/dist/ /code/static/

# copy configs
ARG fromconfig="./config/default.json"
COPY $fromconfig /code/config.json
COPY "./config/base.json"  /code/base.json

# create non root user
RUN useradd -m appuser && chown -R appuser /code
USER appuser

EXPOSE 8000
CMD ["gunicorn", "app:backend"]
