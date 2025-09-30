# small ubi10 image
FROM registry.access.redhat.com/ubi10/ubi-minimal:latest@sha256:649f7ce8082531148ac5e45b61612046a21e36648ab096a77e6ba0c94428cf60


COPY --from=ghcr.io/astral-sh/uv:latest@sha256:9874eb7afe5ca16c363fe80b294fe700e460df29a55532bbfea234a0f12eddb1 /uv /uvx /bin/

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy from the cache instead of linking since it's a mounted volume
ENV UV_LINK_MODE=copy

WORKDIR /app

# Leverage layer cache
COPY pyproject.toml uv.lock ./
COPY departements.json* ./

# Install dependencies
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --locked --no-install-project

# copy the application files
COPY /src  .

# Install the project
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --locked

# Add version information
ARG COMMIT
ARG VERSION
ENV MUCGPT_CORE_VERSION=${VERSION}
ENV MUCGPT_CORE_COMMIT=${COMMIT}

# Metadata for the image
ARG IMAGE_CREATED="unknown"
ARG IMAGE_REVISION="unknown"
ARG IMAGE_VERSION="unknown"
LABEL org.opencontainers.image.authors='Landeshauptstadt München <opensource@muenchen.de>' \
    org.opencontainers.image.vendor='Landeshauptstadt München' \
    org.opencontainers.image.created="$IMAGE_CREATED" \
    org.opencontainers.image.revision="$IMAGE_REVISION" \
    org.opencontainers.image.version="$IMAGE_VERSION" \
    org.opencontainers.image.url='ghcr.io/it-at-m/mucgpt/mucgpt-core' \
    org.opencontainers.image.documentation='https://github.com/it-at-m/mucgpt/blob/main/README.md' \
    org.opencontainers.image.source='https://github.com/it-at-m/mucgpt' \
    org.opencontainers.image.licenses='MIT' \
    org.opencontainers.image.title='mucgpt-core-service' \
    org.opencontainers.image.description="The core backend for MUCGPT. Handles agent state, tools and the underlying communiction with the LLM."

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


EXPOSE 8000
CMD ["python","-m",  "uvicorn", "app:backend", "--host", "0.0.0.0", "--port", "8000"]
