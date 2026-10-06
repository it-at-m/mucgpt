# syntax=docker/dockerfile:1.27@sha256:4edf897a3ffa55b89f906fc8cc78afdb3f1834cc9c7083565e611a8a7d5fe99e
FROM registry.access.redhat.com/ubi10/ubi-minimal:latest@sha256:204e1531cee54562b107fb31e0b327062fc3d5d67af7cc0d2e66b2c572b9044f

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

# Set proxy variables only for build time
ENV HTTP_PROXY=${HTTP_PROXY} \
    HTTPS_PROXY=${HTTPS_PROXY} \
    NO_PROXY=${NO_PROXY} \
    http_proxy=${HTTP_PROXY} \
    https_proxy=${HTTPS_PROXY}

# Install dependencies
RUN microdnf install -y python3 python3-pip ca-certificates curl tar gzip && \
    microdnf clean all

# Install uv manually by downloading the binary directly
RUN curl -LsSf https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-unknown-linux-gnu.tar.gz -o /tmp/uv.tar.gz && \
    tar -xzf /tmp/uv.tar.gz -C /tmp && \
    mv /tmp/uv-x86_64-unknown-linux-gnu/uv /usr/local/bin/uv && \
    chmod +x /usr/local/bin/uv && \
    rm -rf /tmp/uv* && \
    uv --version

# Install shadow-utils for useradd command
RUN microdnf install -y shadow-utils && \
    microdnf clean all

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash mcpuser && \
    mkdir -p /opt/uv && \
    chown -R mcpuser:mcpuser /opt/uv /home/mcpuser

# Switch to non-root user
USER mcpuser
WORKDIR /home/mcpuser

COPY --chown=mcpuser:mcpuser pyproject.toml uv.lock ./

# Set environment for uv
ENV UV_TOOL_HOME=/opt/uv \
    UV_PROJECT_ENVIRONMENT=/opt/uv/mcpdoc \
    PATH="/home/mcpuser/.local/bin:${PATH}"

# Install mcpdoc project dependencies as non-root user
RUN uv sync --frozen --no-dev --no-install-project && \
    uv run --no-sync mcpdoc --help

# Remove proxy variables from runtime environment
ENV HTTP_PROXY= \
    HTTPS_PROXY= \
    NO_PROXY= \
    http_proxy= \
    https_proxy=

ENTRYPOINT ["uv", "run", "--no-sync"]