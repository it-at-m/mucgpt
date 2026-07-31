# syntax=docker/dockerfile:1.25@sha256:0adf442eae370b6087e08edc7c50b552d80ddf261576f4ebd6421006b2461f12
FROM registry.access.redhat.com/ubi10/ubi-minimal:latest@sha256:04140c8d78c6c6915b5c1fdad2f16d10eac3630c3339999ccdf659d8c903be50

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