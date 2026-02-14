from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from database import SessionLocal, Property

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For demo; replace with your Vercel URL later
    allow_methods=["*"],
    allow_headers=["*"],
)
# Dependency to get the DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/properties")
def get_properties(db: Session = Depends(get_db)):
    return db.query(Property).all()

@app.post("/properties")
def create_property(prop_data: dict, db: Session = Depends(get_db)):
    new_prop = Property(**prop_data)
    db.add(new_prop)
    db.commit()
    db.refresh(new_prop)
    return new_prop
