FROM python:3.12-slim@sha256:34656cd90456349040784165b9decccbcee4de66f3ead0a1168ba893455afd1e  AS python-builder
COPY --from=ghcr.io/astral-sh/uv:latest@sha256:3b898ca84fbe7628c5adcd836c1de78a0f1ded68344d019af8478d4358417399 /uv /bin/uv

WORKDIR /code

# copy uv version infos
COPY uv.lock .
COPY pyproject.toml .

# Install dependencies
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project

# copy only the required directories for migrations
COPY /migrations /code/migrations

# sync the project
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen

# Make sure migrations directory is in the path
ENV PYTHONPATH="/code/migrations:${PYTHONPATH}"

# Run migrations by default using uv
ENTRYPOINT ["uv", "run", "migrations/run_migrations.py"]
