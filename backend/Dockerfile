FROM python:3.12-slim

# Install system dependencies including ffmpeg for audio chunking and normalization
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend source code
COPY . .

# Default port for Railway / container hosts
ENV PORT=8000
EXPOSE 8000

# Default command runs database migrations, starts worker in background, then starts FastAPI with Uvicorn
CMD ["sh", "-c", "alembic upgrade head && (python -m app.worker &) && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
