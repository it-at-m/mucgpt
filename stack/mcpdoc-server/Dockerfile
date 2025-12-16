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

# Set environment for uv
ENV UV_TOOL_HOME=/opt/uv \
    PATH="/home/mcpuser/.local/bin:${PATH}"

# Install mcpdoc as non-root user
RUN uv tool install --force mcpdoc && \
    uv tool list

# Remove proxy variables from runtime environment
ENV HTTP_PROXY= \
    HTTPS_PROXY= \
    NO_PROXY= \
    http_proxy= \
    https_proxy=

ENTRYPOINT ["uv"]
