# syntax=docker/dockerfile:1.7
FROM registry.access.redhat.com/ubi10/ubi-minimal:latest@sha256:28ec2f4662bdc4b0d4893ef0d8aebf36a5165dfb1d1dc9f46319bd8a03ed3365

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

# Set proxy variables only for build time
ENV HTTP_PROXY=${HTTP_PROXY} \
    HTTPS_PROXY=${HTTPS_PROXY} \
    NO_PROXY=${NO_PROXY} \
    http_proxy=${HTTP_PROXY} \
    https_proxy=${HTTPS_PROXY} \
    no_proxy=${NO_PROXY}

# Install dependencies
RUN microdnf install -y python3 python3-pip ca-certificates curl && \
    microdnf clean all

# Install uv and mcpdoc as non-root user
RUN set -eux; \
    curl -LsSf https://astral.sh/uv/install.sh | sh; \
    uv --version; \
    uv tool install --force mcpdoc; \
    uv tool list

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash mcpuser && \
    mkdir -p /opt/uv && \
    chown -R mcpuser:mcpuser /opt/uv /home/mcpuser

# Remove proxy variables from runtime environment
ENV HTTP_PROXY= \
    HTTPS_PROXY= \
    NO_PROXY= \
    http_proxy= \
    https_proxy= \
    no_proxy= \
    UV_TOOL_HOME=/opt/uv \
    PATH="/home/mcpuser/.local/bin:${PATH}"

USER mcpuser
WORKDIR /home/mcpuser

ENTRYPOINT ["uv"]
