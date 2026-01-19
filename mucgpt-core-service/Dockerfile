# small ubi10 image
FROM registry.access.redhat.com/ubi10/ubi-minimal:latest@sha256:67aafc6c9c44374e1baf340110d4c835457d59a0444c068ba9ac6431a6d9e7ac


COPY --from=ghcr.io/astral-sh/uv:latest@sha256:9a23023be68b2ed09750ae636228e903a54a05ea56ed03a934d00fe9fbeded4b /uv /uvx /bin/

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1

# Copy from the cache instead of linking since it's a mounted volume
ENV UV_LINK_MODE=copy

WORKDIR /app

# Leverage layer cache
COPY pyproject.toml uv.lock ./

# Install build dependencies for packages with C extensions
RUN microdnf install -y gcc python3-devel

# Install dependencies
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --locked --no-install-project

# copy the application files
COPY /src  .

# Install the project
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-dev --locked

# Remove build dependencies to keep image small
RUN microdnf remove -y gcc python3-devel && \
    microdnf clean all

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
