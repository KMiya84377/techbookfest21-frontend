# AgentCore Runtime は ARM64 のコンテナが必須
# ビルドのコンテキストは chat-agent/(batch-agent/ とは、環境を完全に分ける)
FROM --platform=linux/arm64 ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# 依存パッケージ(ロックファイルどおりにインストール)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY chat ./chat

ENV PYTHONUNBUFFERED=1
EXPOSE 8080

CMD ["uv", "run", "--no-dev", "python", "-m", "chat.main"]
