import sys
from app.database import SessionLocal
from app.models import Recording, Chunk

db = SessionLocal()
r = db.query(Recording).filter(Recording.id == "9165f97a-b326-426d-849a-1e1363e8d842").first()
if r:
    print(f"Rec {r.id}, Status: {r.status}, Transcript: {r.transcript_status}, Summary: {r.summary_status}")
    print(f"Error: {r.error_message}")
    for c in db.query(Chunk).filter(Chunk.recording_id == r.id).all():
        print(f"  Chunk {c.idx}: {c.status} (err: {c.error})")
