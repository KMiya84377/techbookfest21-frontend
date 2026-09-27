# AgentCore Runtime は ARM64 のコンテナが必須
FROM --platform=linux/arm64 ghcr.io/astral-sh/uv:python3.12-bookworm-slim

WORKDIR /app

# 依存パッケージ(ロックファイルどおりにインストール)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY main.py tools.py ./

ENV PYTHONUNBUFFERED=1
EXPOSE 8080

CMD ["uv", "run", "--no-dev", "python", "main.py"]
