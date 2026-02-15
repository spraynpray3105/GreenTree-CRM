from fastapi import FastAPI, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta
import os

from database import SessionLocal, Property, User  # ensure User model is defined in database.py

from fastapi.middleware.cors import CORSMiddleware

# Security libs
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

# ----------------------
# Auth configuration
# ----------------------
PWD_CTX = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")  # set in .env for production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))  # default 60 minutes (login valid 1 hour)

def hash_password(password: str) -> str:
    return PWD_CTX.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return PWD_CTX.verify(plain_password, hashed_password)

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

# ----------------------
# Auth endpoints
# ----------------------
@app.post("/register", status_code=201)
def register(user_in: UserCreate, response: Response, db: Session = Depends(get_db)):
    # check by email if provided, otherwise by name
    if user_in.email:
        exists = db.query(User).filter(User.email == user_in.email).first()
        if exists:
            raise HTTPException(status_code=400, detail="Email already registered")
    exists_name = db.query(User).filter(User.name == user_in.name).first()
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
        user = db.query(User).filter(User.email == creds.email).first()
    elif creds.name:
        user = db.query(User).filter(User.name == creds.name).first()

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
    user = db.query(User).filter(User.id == user_id).first()
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
    return db.query(Property).all()

@app.post("/properties", status_code=201)
def create_property(prop_data: PropertyCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # creation requires authentication; you can store current_user.id as created_by if you extend model
    new_prop = Property(
        address=prop_data.address,
        status=prop_data.status,
        price=prop_data.price,
        agent=prop_data.agent
    )
    db.add(new_prop)
    db.commit()
    db.refresh(new_prop)
    return new_prop
