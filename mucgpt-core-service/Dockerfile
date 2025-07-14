FROM python:3.12-slim@sha256:34656cd90456349040784165b9decccbcee4de66f3ead0a1168ba893455afd1e AS python-builder
COPY --from=ghcr.io/astral-sh/uv:latest@sha256:3b898ca84fbe7628c5adcd836c1de78a0f1ded68344d019af8478d4358417399 /uv /bin/uv

WORKDIR /code

# Copy only dependency files first for better caching
COPY uv.lock pyproject.toml ./
COPY departements.json* ./

# Install dependencies
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project

# copy data from builder and backend srcs
COPY /src  .

# Add version information
ARG COMMIT
ARG VERSION
ENV MUCGPT_CORE_VERSION=${VERSION}
ENV MUCGPT_CORE_COMMIT=${COMMIT}

# Sync the project
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen

# Create a non-root user and switch to it
RUN adduser --disabled-password --gecos '' appuser && chown -R appuser /code
USER appuser

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app:backend", "--host", "0.0.0.0", "--port", "8000"]
