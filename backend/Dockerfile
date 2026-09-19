FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

ENV PYTHONUNBUFFERED=1 UV_COMPILE_BYTECODE=1 PATH=/app/.venv/bin:$PATH
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app \
    && useradd --system --gid app --home-dir /app app

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev

COPY --chown=app:app . .
RUN chmod +x /app/docker-entrypoint.sh \
    && mkdir -p /app/staticfiles \
    && chown app:app /app /app/staticfiles

USER app

EXPOSE 8000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
