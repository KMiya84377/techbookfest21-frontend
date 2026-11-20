# 定期実行用のHTTP AgentCore Runtime
# ビルドのコンテキストは batch-agent/(chat-agent/ とは、環境を完全に分ける)
FROM --platform=linux/arm64 ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY batch ./batch

ENV PYTHONUNBUFFERED=1
EXPOSE 8080

CMD ["uv", "run", "--no-dev", "python", "-m", "batch.main"]
