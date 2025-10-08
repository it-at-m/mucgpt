# small ubi10 image
FROM registry.access.redhat.com/ubi10/ubi-minimal:latest@sha256:649f7ce8082531148ac5e45b61612046a21e36648ab096a77e6ba0c94428cf60

COPY --from=ghcr.io/astral-sh/uv:latest@sha256:8f926a80debadba6f18442030df316c0e2b28d6af62d1292fb44b1c874173dc0 /uv /uvx /bin/

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy from the cache instead of linking since it's a mounted volume
ENV UV_LINK_MODE=copy

# Set cache directory to a location we have permissions to write to
ENV UV_CACHE_DIR=/app/.cache/uv

WORKDIR /app

# Leverage layer cache
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN --mount=type=cache,target=/app/.cache/uv \
    uv sync --no-dev --locked --no-install-project

# copy only the required directories for migrations
COPY /migrations /app/migrations
COPY /test_db_connection.py /app/

# Install the project
RUN --mount=type=cache,target=/app/.cache/uv \
    uv sync --no-dev --locked

# Make sure migrations directory is in the path
ENV PYTHONPATH="/app/migrations:${PYTHONPATH}"


# Metadata for the image
ARG IMAGE_CREATED="unknown"
ARG IMAGE_REVISION="unknown"
ARG IMAGE_VERSION="unknown"
LABEL org.opencontainers.image.authors='Landeshauptstadt München <opensource@muenchen.de>' \
    org.opencontainers.image.vendor='Landeshauptstadt München' \
    org.opencontainers.image.created="$IMAGE_CREATED" \
    org.opencontainers.image.revision="$IMAGE_REVISION" \
    org.opencontainers.image.version="$IMAGE_VERSION" \
    org.opencontainers.image.url='ghcr.io/it-at-m/mucgpt/mucgpt-assistant-migrations' \
    org.opencontainers.image.documentation='https://github.com/it-at-m/mucgpt/blob/main/README.md' \
    org.opencontainers.image.source='https://github.com/it-at-m/mucgpt' \
    org.opencontainers.image.licenses='MIT' \
    org.opencontainers.image.title='mucgpt-assistant-service-migrations' \
    org.opencontainers.image.description="Database migration service for MUCGPT."

# Give permissions to all so random UID can write
# This should be compatible with OpenShift and plain K8s
RUN chown -R root:0 /app && chmod -R g=u /app

# Place executables in the environment at the front of the path
ENV PATH="/app/.venv/bin:$PATH"

# Disable tqdm for cleaner logs
ENV TQDM_DISABLE=1
ENV HF_HUB_DISABLE_PROGRESS_BARS=1

# Disable python warnings
ENV PYTHONWARNINGS="ignore"

ENV APP_VERSION=${IMAGE_VERSION}

# Run migrations by default using uv
ENTRYPOINT ["uv", "run", "migrations/run_migrations.py"]
