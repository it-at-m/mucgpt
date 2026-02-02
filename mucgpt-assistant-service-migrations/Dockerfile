# small ubi10 image
FROM registry.access.redhat.com/ubi10/ubi-minimal:latest@sha256:f8c05e3c6d15fea32e59635477c0f690e6d4b88a81924e8619f369e57306b701

COPY --from=ghcr.io/astral-sh/uv:latest@sha256:59240a65d6b57e6c507429b45f01b8f2c7c0bbeee0fb697c41a39c6a8e3a4cfb /uv /uvx /bin/

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy from the cache instead of linking since it's a mounted volume
ENV UV_LINK_MODE=copy

# Set cache directory to a location we have permissions to write to
ENV UV_CACHE_DIR=/app/.cache/uv

WORKDIR /app

# Leverage layer cache
COPY pyproject.toml uv.lock ./

# Install build dependencies for packages with C extensions
RUN microdnf install -y gcc python3-devel

# Install dependencies
RUN --mount=type=cache,target=/app/.cache/uv \
    uv sync --no-dev --locked --no-install-project

# copy only the required directories for migrations
COPY /migrations /app/migrations
COPY /test_db_connection.py /app/

# Install the project
RUN --mount=type=cache,target=/app/.cache/uv \
    uv sync --no-dev --locked

# Remove build dependencies to keep image small
RUN microdnf remove -y gcc python3-devel && \
    microdnf clean all

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
