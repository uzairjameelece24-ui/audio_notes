import sys
from app.database import SessionLocal
from app.models import Job

db = SessionLocal()
for j in db.query(Job).all():
    print(f"ID: {j.id}, Status: {j.status}, Kind: {j.kind}, RunAt: {j.run_at}, Created: {j.created_at}")
