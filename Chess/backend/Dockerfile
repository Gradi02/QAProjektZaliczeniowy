FROM python:3.11-slim as builder

ENV POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false \
    PYTHONUNBUFFERED=1

WORKDIR /app
RUN apt-get update && apt-get install -y curl tar && rm -rf /var/lib/apt/lists/*
RUN pip install poetry
COPY pyproject.toml poetry.lock ./
RUN poetry install --no-root --only main

COPY . .

FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
RUN addgroup --system app && adduser --system --group app

WORKDIR /app

RUN apt-get update && apt-get install -y curl tar && rm -rf /var/lib/apt/lists/*
ENV STOCKFISH_VERSION=sf_17
RUN curl -L -o stockfish.tar https://github.com/official-stockfish/Stockfish/releases/download/${STOCKFISH_VERSION}/stockfish-ubuntu-x86-64-avx2.tar \
    && tar -xf stockfish.tar \
    && mv stockfish/stockfish-ubuntu-x86-64-avx2 /usr/local/bin/stockfish \
    && chmod +x /usr/local/bin/stockfish \
    && rm -rf stockfish stockfish.tar

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

COPY --from=builder /app /app
COPY app/vosk-model-small-pl-0.22 /vosk-model

RUN chown -R app:app /app
USER app