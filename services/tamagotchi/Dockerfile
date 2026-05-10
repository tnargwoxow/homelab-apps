FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /srv

COPY pyproject.toml ./
RUN pip install \
    "fastapi==0.115.4" \
    "uvicorn[standard]==0.32.0" \
    "pydantic==2.9.2"

COPY app ./app
COPY web ./web

RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin tamagotchi \
 && mkdir -p /data \
 && chown -R tamagotchi:tamagotchi /data /srv

USER tamagotchi

ENV TAMAGOTCHI_DB=/data/tamagotchi.db
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
