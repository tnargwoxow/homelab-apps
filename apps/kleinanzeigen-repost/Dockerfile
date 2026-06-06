FROM python:3.12-slim

WORKDIR /app

# Install the package (and its deps: requests, flask, gunicorn).
COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir .

ENV PORT=8090
EXPOSE 8090

# Serve via gunicorn. Single worker is plenty for a personal tool, and keeps the
# in-process state simple. Generous timeout: a repost downloads + re-uploads
# several images.
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT} --workers 1 --timeout 180 kleinanzeigen_repost.server:app"]
