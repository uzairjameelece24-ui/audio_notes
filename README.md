# Audio Notes

A full-stack app that transcribes audio recordings of any duration using Gnani's Speech-to-Text API and generates structured summaries using Groq (Qwen 2.5 27B).

Built with Next.js, FastAPI, PostgreSQL, and an S3-compatible bucket.

---

## How It Works

1. **Direct S3 Upload**: The browser requests a presigned PUT URL from FastAPI and uploads the audio file directly to S3Mock / object storage. The API server doesn't handle the raw audio stream, avoiding memory bottlenecks.
2. **Postgres Job Queue**: Once uploaded, the frontend notifies the backend. FastAPI confirms the file exists with an S3 `HEAD` check and inserts a job into a Postgres `jobs` table using `SELECT ... FOR UPDATE SKIP LOCKED`.
3. **Silence-Aware Chunking**: Gnani's STT API rejects any audio longer than 30 seconds. The worker downloads the file, normalizes it to 16kHz mono WAV, detects silent intervals via `ffmpeg silencedetect`, and slices the recording at natural pauses into ~24s chunks (strictly clamped to <= 28.5s).
4. **Parallel Transcription**: Chunks are processed concurrently across 3 worker threads. As each chunk returns, its transcript is committed immediately to the database so the frontend can display live progress.
5. **Summarization**: Stitched transcripts are sent to Groq (`qwen/qwen3.8-27b`) with JSON mode for structured output (TL;DR, key points, action items). Transcripts over 12,000 characters automatically use map-reduce.
6. **Live UI**: The Next.js frontend polls the recording endpoint every 3 seconds, showing a 6-stage pipeline stepper, elapsed time, and real-time chunk progress.

A complete technical breakdown is available inside the running app at `/architecture`.

---

## Project Structure

```text
├── backend/
│   ├── alembic/              # Database migrations (recordings, chunks, jobs)
│   ├── app/
│   │   ├── routers/          # FastAPI routes: uploads, recordings, health
│   │   ├── services/         # ASR client, chunking, LLM, S3 storage, queue
│   │   ├── worker.py         # Background worker loop & thread pool
│   │   ├── models.py         # SQLAlchemy ORM models
│   │   └── config.py         # Settings & failure injection toggles
│   ├── scripts/              # Pipeline verification script
│   └── tests/                # Unit & integration test suite
├── frontend/
│   ├── src/app/              # Next.js App Router (/, /recordings/[id], /architecture)
│   ├── src/components/       # UI components (UploadCard, StatusStepper, etc.)
│   └── src/lib/api.ts        # Client API SDK & direct S3 XHR uploader
└── docker-compose.yml        # Local PostgreSQL & S3Mock containers
```

---

## Running Locally

### Prerequisites
- Docker & Docker Compose
- Python 3.12+ with `ffmpeg` installed (`brew install ffmpeg` on macOS)
- Node.js 18+

### 1. Start Postgres and S3Mock
```bash
docker compose up -d
```
This runs PostgreSQL on port `5432` and S3Mock on port `9090`.

### 2. Start the Backend API & Worker
In the `backend/` folder:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Create your .env from the example
cp .env.example .env

# Run database migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --reload --port 8000
```

In a second terminal window, start the worker:
```bash
cd backend
source .venv/bin/activate
python -m app.worker
```

> **Mock Mode:** If `GNANI_API_KEY` or `GROQ_API_KEY` are not set in `.env`, both services run in `mock` mode with simulated processing delays. Set them to `real` with your API keys to call live endpoints.

### 3. Start the Frontend
In the `frontend/` folder:
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Testing & Verification

Run the end-to-end verification script to test normal processing, summary failures, authentication errors, and corrupt audio:

```bash
cd backend
source .venv/bin/activate
python scripts/verify_pipeline.py
```

To run the unit tests:
```bash
cd backend
source .venv/bin/activate
pytest
```

---

## Deployment (Zero AWS: Render + Vercel)

This application runs completely on **Render** (Backend + PostgreSQL Database) and **Vercel** (Frontend) without needing any AWS account or S3 bucket.

### 1. Deploy Backend on Render (1-Click Blueprint)
1. Go to your [Render Dashboard](https://dashboard.render.com/) and click **New +** &rarr; **Blueprint**.
2. Connect your GitHub repository (`uzairjameelece24-ui/audio_notes`).
3. Render reads `render.yaml` and automatically configures:
   - **PostgreSQL Database** (`audio-notes-db`, Free tier)
   - **Docker Web Service** (`audio-notes-backend`, Free tier) with FFmpeg pre-installed
4. Enter your two API keys when prompted:
   - `GNANI_API_KEY`: your Gnani STT token
   - `GROQ_API_KEY`: your Groq API token
5. Click **Apply**. Once deployed, copy your backend URL (e.g. `https://audio-notes-backend.onrender.com`).

### 2. Deploy Frontend on Vercel
1. Go to [Vercel](https://vercel.com/) and click **Add New...** &rarr; **Project**.
2. Select your `audio_notes` repository.
3. Set **Root Directory** to `frontend`.
4. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_API_URL` = `https://<YOUR-RENDER-BACKEND-URL>/api`
   - `NEXT_PUBLIC_GITHUB_URL` = `https://github.com/uzairjameelece24-ui/audio_notes`
5. Click **Deploy**.

---

## Architecture & System Design

Navigate to [http://localhost:3000/architecture](http://localhost:3000/architecture) for:
- System components & hosting boundaries
- Step-by-step pipeline flow from upload to summary
- Where files live (S3, local ephemeral disk, Postgres)
- Chunking algorithm details & silence window selection
- Synchronous API vs. background worker division
- Progress tracking and polling mechanics
- Complete failure handling matrix (retries, corrupt audio, timeouts, partial transcripts)
- Proposed production improvements (Batch API, SSE, resumable uploads, speaker diarization)
