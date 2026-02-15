from fastapi import FastAPI, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError
from types import SimpleNamespace
from pydantic import BaseModel
from datetime import datetime, timedelta
import os

from database import SessionLocal, Property, User, Photographer  # ensure Photographer model is available
from sun_logic import get_optimal_times
from geopy.geocoders import Nominatim

from fastapi.middleware.cors import CORSMiddleware

# Security libs
# use a pure-python, well-supported scheme that accepts long passwords
from passlib.context import CryptContext
from jose import jwt, JWTError

app = FastAPI()

# CORS: allow credentials so httpOnly cookie auth works from frontend (use restricted origins in prod)
origins = [
    "http://localhost:3000",   # dev frontend origin (change if different)
    "http://localhost:8000",   # optional
    "https://greentree-crm.onrender.com"  # production frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# DB session dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Helper: safe user lookup wrappers. Some deployed DBs may not have new columns yet
# (for example `users.company`), which would make ORM queries raise ProgrammingError.
# These helpers attempt an ORM query first and fall back to a textual select of the
# known columns so the app continues to authenticate until you run a migration.
def _user_from_row(row):
    if not row:
        return None
    # row may be an ORM-mapped User instance or a mapping result
    if isinstance(row, SimpleNamespace) or hasattr(row, 'id') and hasattr(row, 'name'):
        return row
    try:
        # SQLAlchemy MappingResult -> dict-like
        m = dict(row)
        return SimpleNamespace(**m)
    except Exception:
        return row

def find_user_by_name(db: Session, name: str):
    try:
        return db.query(User).filter(User.name == name).first()
    except ProgrammingError:
        # likely the DB schema missing a column; rollback and run a safe text query
        db.rollback()
        row = db.execute(text("SELECT id, name, email, hashed_password, created_at FROM users WHERE name = :name LIMIT 1"), {"name": name}).mappings().first()
        return _user_from_row(row)


def find_user_by_email(db: Session, email: str):
    try:
        return db.query(User).filter(User.email == email).first()
    except ProgrammingError:
        db.rollback()
        row = db.execute(text("SELECT id, name, email, hashed_password, created_at FROM users WHERE email = :email LIMIT 1"), {"email": email}).mappings().first()
        return _user_from_row(row)


def find_user_by_id(db: Session, user_id: int):
    try:
        return db.query(User).filter(User.id == user_id).first()
    except ProgrammingError:
        db.rollback()
        row = db.execute(text("SELECT id, name, email, hashed_password, created_at FROM users WHERE id = :id LIMIT 1"), {"id": user_id}).mappings().first()
        return _user_from_row(row)

# ----------------------
# Auth configuration
# ----------------------
# Use pbkdf2_sha256 (pure-python, no bcrypt C binding). Accepts long inputs and avoids 72-byte bcrypt limit.
PWD_CTX = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")  # set in .env for production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))  # default 60 minutes (login valid 1 hour)

def hash_password(password: str) -> str:
    return PWD_CTX.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify password safely. If the incoming plain_password is too long or invalid
    for the underlying bcrypt implementation, treat it as a failed login instead
    of raising a 500 error.
    """
    try:
        return PWD_CTX.verify(plain_password, hashed_password)
    except (ValueError, TypeError) as exc:
        # treat as authentication failure
        return False

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

# ----------------------
# Pydantic models
# ----------------------
class UserCreate(BaseModel):
    name: str
    email: str | None = None
    password: str

class UserLogin(BaseModel):
    name: str | None = None
    email: str | None = None
    password: str

class PropertyCreate(BaseModel):
    address: str
    status: str = "Active"
    price: float = 0
    agent: str | None = ""
    photographer_id: int | None = None
    company: str | None = None

class PhotographerCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    company: str | None = None

# ----------------------
# Auth endpoints
# ----------------------
@app.post("/register", status_code=201)
def register(user_in: UserCreate, response: Response, db: Session = Depends(get_db)):
    # check by email if provided, otherwise by name
    if user_in.email:
        exists = find_user_by_email(db, user_in.email)
        if exists:
            raise HTTPException(status_code=400, detail="Email already registered")
    exists_name = find_user_by_name(db, user_in.name)
    if exists_name:
        raise HTTPException(status_code=400, detail="Username already registered")

    hashed = hash_password(user_in.password)
    # store proper datetime object (DB column is DateTime)
    user = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=hashed,
        created_at=datetime.utcnow()
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # create token and return it so frontend can store/use it (also set cookie for compat)
    token = create_access_token({"sub": user.name, "user_id": user.id})
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    return {"id": user.id, "name": user.name, "email": user.email, "access_token": token}

@app.post("/login")
def login(creds: UserLogin, response: Response, db: Session = Depends(get_db)):
    # allow login by email or name
    user = None
    if creds.email:
        user = find_user_by_email(db, creds.email)
    elif creds.name:
        user = find_user_by_name(db, creds.name)

    if not user or not verify_password(creds.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({"sub": user.name, "user_id": user.id})
    # Set httpOnly cookie for compatibility, but also return token in body
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # change to True when serving over HTTPS
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )
    return {"message": "login successful", "access_token": token}

# Helper dependency: reads token from cookie or Authorization header
def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1]
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    user = find_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

@app.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "name": current_user.name, "email": current_user.email}

# ----------------------
# Existing properties endpoints
# ----------------------
@app.get("/properties")
def get_properties(db: Session = Depends(get_db)):
    # public read access (change to protected if desired)
    # Some deployments may not have the latest schema (new columns/FKs).
    # Try the ORM query first; if the DB raises ProgrammingError (missing column),
    # fall back to a safe textual select that only references guaranteed columns.
    try:
        return db.query(Property).all()
    except ProgrammingError:
        # rollback the failed transaction and run a safe text query
        db.rollback()
        rows = db.execute(text("SELECT id, address, status, price, agent, company FROM properties")).mappings().all()
        return [dict(r) for r in rows]

@app.post("/properties", status_code=201)
def create_property(prop_data: PropertyCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # creation requires authentication; you can store current_user.id as created_by if you extend model
    new_prop = Property(
        address=prop_data.address,
        status=prop_data.status,
        price=prop_data.price,
        agent=prop_data.agent,
        photographer_id=prop_data.photographer_id,
        company=prop_data.company
    )
    db.add(new_prop)
    db.commit()
    db.refresh(new_prop)
    return new_prop
 

# ----------------------
# Photographers endpoints
# ----------------------
@app.get("/photographers")
def list_photographers(db: Session = Depends(get_db)):
    return db.query(Photographer).all()


@app.post("/photographers", status_code=201)
def create_photographer(p: PhotographerCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # require auth to create photographers
    # basic uniqueness check by email if provided
    if p.email:
        exists = db.query(Photographer).filter(Photographer.email == p.email).first()
        if exists:
            raise HTTPException(status_code=400, detail="Photographer with that email already exists")
    new_p = Photographer(name=p.name, email=p.email, phone=p.phone, company=p.company)
    db.add(new_p)
    db.commit()
    db.refresh(new_p)
    return new_p


@app.delete("/photographers/{photographer_id}")
def delete_photographer(photographer_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ph = db.query(Photographer).filter(Photographer.id == photographer_id).first()
    if not ph:
        raise HTTPException(status_code=404, detail="Photographer not found")
    # optionally reassign or nullify photographer_id on properties that reference this photographer
    props = db.query(Property).filter(Property.photographer_id == ph.id).all()
    for pr in props:
        pr.photographer_id = None
    db.delete(ph)
    db.commit()
    return {"message": "deleted"}


# ----------------------
# Sun times / watcher
# ----------------------
@app.get("/sun")
def sun_times(address: str):
    # Geocode the address using Nominatim (OpenStreetMap). Keep this public-read.
    try:
        geolocator = Nominatim(user_agent="greentree_crm")
        location = geolocator.geocode(address)
        if not location:
            raise HTTPException(status_code=404, detail="Address not found")
        lat, lng = location.latitude, location.longitude
        times = get_optimal_times(lat, lng)
        return {"address": address, "latitude": lat, "longitude": lng, "times": times}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
