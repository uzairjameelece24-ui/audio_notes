# Multi-stage build: copy static ffmpeg & ffprobe directly (zero apt-get dependencies, 100% reliable)
FROM mwader/static-ffmpeg:6.1 AS ffmpeg-source

FROM python:3.12-slim-bookworm

# Copy static ffmpeg and ffprobe binaries
COPY --from=ffmpeg-source /ffmpeg /usr/local/bin/ffmpeg
COPY --from=ffmpeg-source /ffprobe /usr/local/bin/ffprobe

WORKDIR /app

# Install python dependencies
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . .

# Default port for Railway / container hosts
ENV PORT=8000
EXPOSE 8000

# Default command runs database migrations, starts worker in background, then starts FastAPI with Uvicorn
CMD ["sh", "-c", "alembic upgrade head && (python -m app.worker &) && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
