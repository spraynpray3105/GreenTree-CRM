from fastapi import FastAPI, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from sqlalchemy import text, func
from sqlalchemy.exc import ProgrammingError
from types import SimpleNamespace
from pydantic import BaseModel
from datetime import datetime, timedelta, date
import os

from database import SessionLocal, Property, User, Photographer, Statistic, Agent  # ensure Photographer + Statistic + Agent models are available
from sun_logic import get_optimal_times
from geopy.geocoders import Nominatim
from ai_services import get_property_update, GROQ_CLIENT, GROQ_MODEL
import asyncio
import time

# Simple in-memory cache for AI summaries to avoid repeated slow calls
AI_CACHE: dict = {}
AI_CACHE_TTL = int(os.getenv("AI_CACHE_TTL_SECONDS", "21600"))  # default 6 hours

async def _refresh_ai_cache(address: str, user_id: int | None = None):
    """Background task that refreshes the AI cache for an address.

    If user_id is provided, the cache key will be scoped to that user so
    summaries are cached per-session. If user_id is None we fall back to the
    legacy address-only key.
    """
    try:
        res = await asyncio.to_thread(get_property_update, address)
        if isinstance(res, dict) and not res.get('error'):
            key = f"user:{user_id}|addr:{address.lower().strip()}" if user_id is not None else address.lower().strip()
            AI_CACHE[key] = (res, time.time())
    except Exception:
        # ignore background refresh failures
        pass

from fastapi.middleware.cors import CORSMiddleware

# Security libs
# use a pure-python, well-supported scheme that accepts long passwords
from passlib.context import CryptContext
from jose import jwt, JWTError

app = FastAPI()

# CORS: allow credentials so httpOnly cookie auth works from frontend (use restricted origins in prod)
# CORS: allow credentials so httpOnly cookie auth works from frontend.
# Use an explicit allowlist. You can set FRONTEND_ORIGINS env var (comma-separated)
# to add more allowed origins in production (for example Vercel domain).
default_origins = [
    "http://localhost:3000",
    "http://localhost:8000",
    "https://greentree-crm.onrender.com",
    # common Vercel hostname used by frontend deploys (add your exact domain if different)
    "https://green-tree-crm.vercel.app",
]
env_frontends = os.getenv("FRONTEND_ORIGINS")
if env_frontends:
    env_list = [s.strip() for s in env_frontends.split(",") if s.strip()]
    # preserve env-provided origins first, then defaults; remove duplicates
    origins = list(dict.fromkeys(env_list + default_origins))
else:
    origins = default_origins

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
# Use pbkdf2_sha256 (pure-python). Accepts long inputs and avoids 72-byte bcrypt limit.
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
    image_url: str | None = None

class PaidUpdate(BaseModel):
    paid: bool
class PropertyUpdate(BaseModel):
    address: str | None = None
    status: str | None = None
    price: float | None = None
    agent: str | None = None
    company: str | None = None
    photographer_id: int | None = None
    paid: bool | None = None
    image_url: str | None = None
class PhotographerCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    company: str | None = None


class AgentCreate(BaseModel):
    name: str
    email: str | None = None
    phone: str | None = None
    company: str | None = None


class AgentUpdate(BaseModel):
    name: str | None = None
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
# AI helpers / endpoints
# ----------------------
@app.get("/ai/summary")
async def ai_summary(address: str, current_user: User = Depends(get_current_user)):
    """Return a short AI-generated summary for a single property address.
    Uses `ai_services.get_property_update` and returns a compact summary and an indicator.
    """
    # Use a per-session cache key so each user's session has its own AI summary cache.
    key = f"user:{current_user.id}|addr:{address.lower().strip()}"

    # Return cached result if fresh
    cached = AI_CACHE.get(key)
    if cached:
        res_obj, ts = cached
        if (time.time() - ts) < AI_CACHE_TTL:
            # normalize and return quickly
            status = (res_obj.get('status') or '').title() if res_obj.get('status') else 'Unknown'
            sold_date = res_obj.get('sold_date')
            confidence = res_obj.get('confidence')
            summary = res_obj.get('summary') if isinstance(res_obj.get('summary'), str) else None
            short = status
            if sold_date:
                short += f" on {sold_date}"
            if confidence is not None:
                try:
                    short += f" (confidence {float(confidence):.2f})"
                except Exception:
                    pass
            if summary:
                short += f": {summary}"
            indicator = None
            if status.lower() == 'sold':
                indicator = 'SOLD'
            elif status.lower() == 'active':
                indicator = 'ACTIVE'
            elif status.lower() == 'pending':
                indicator = 'PENDING'
            return { 'address': address, 'status': status, 'sold_date': sold_date, 'confidence': confidence, 'summary': short, 'indicator': indicator }

    # Not cached or expired: attempt to fetch but don't block too long
    try:
        # Try calling the blocking helper in a thread with a short timeout
        res = await asyncio.wait_for(asyncio.to_thread(get_property_update, address), timeout=6.0)
    except asyncio.TimeoutError:
        # schedule a background refresh (scoped to this user) and return a low-confidence placeholder quickly
        asyncio.create_task(_refresh_ai_cache(address, user_id=current_user.id))
        return { 'address': address, 'status': 'Unknown', 'sold_date': None, 'confidence': 0.0, 'summary': 'AI summary pending (request timed out); refresh shortly', 'indicator': None }
    except Exception as e:
        # schedule background refresh (scoped to this user) and return an error-like placeholder
        asyncio.create_task(_refresh_ai_cache(address, user_id=current_user.id))
        raise HTTPException(status_code=502, detail=f"AI service error: {str(e)}")

    # If the helper indicates quota/rate-limit exhaustion, surface 429 with Retry-After
    if isinstance(res, dict) and res.get('quota_exceeded'):
        # schedule a background refresh attempt for later (scoped to this user)
        asyncio.create_task(_refresh_ai_cache(address, user_id=current_user.id))
        retry = res.get('retry_after_seconds') or 60
        raise HTTPException(status_code=429, detail=res.get('error') or 'Quota exceeded', headers={"Retry-After": str(int(retry))})

    if isinstance(res, dict) and res.get('error'):
        # If helper returned an error dict, schedule a refresh (scoped to this user) and surface helpful message
        asyncio.create_task(_refresh_ai_cache(address, user_id=current_user.id))
        raise HTTPException(status_code=502, detail=f"AI service error: {res.get('error')}")

    if not isinstance(res, dict):
        raise HTTPException(status_code=500, detail="AI returned unexpected response")

    # store in session-scoped cache
    AI_CACHE[key] = (res, time.time())

    status = (res.get('status') or '').title() if res.get('status') else 'Unknown'
    sold_date = res.get('sold_date')
    confidence = res.get('confidence')
    summary = res.get('summary') if isinstance(res.get('summary'), str) else None

    short = status
    if sold_date:
        short += f" on {sold_date}"
    if confidence is not None:
        try:
            short += f" (confidence {float(confidence):.2f})"
        except Exception:
            pass
    if summary:
        short += f": {summary}"

    indicator = None
    if status.lower() == 'sold':
        indicator = 'SOLD'
    elif status.lower() == 'active':
        indicator = 'ACTIVE'
    elif status.lower() == 'pending':
        indicator = 'PENDING'

    return { 'address': address, 'status': status, 'sold_date': sold_date, 'confidence': confidence, 'summary': short, 'indicator': indicator }


@app.post("/ai/sync")
async def ai_sync_properties(payload: dict | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Sync AI summaries for properties belonging to the current user's company.
    Optional JSON body: { "property_ids": [1,2,3] } to limit to specific properties.
    Returns a mapping of property_id -> ai summary object.
    """
    try:
        # Select properties scoped to the current user's company for SaaS safety
        q = db.query(Property)
        if current_user and getattr(current_user, 'company', None):
            q = q.filter(Property.company == current_user.company)

        # If payload requests specific ids, filter
        ids = None
        if payload and isinstance(payload, dict):
            ids = payload.get('property_ids')
        if ids:
            q = q.filter(Property.id.in_(ids))

        props = q.all()
    except ProgrammingError:
        db.rollback()
        # Fallback: textual select
        rows = db.execute(text("SELECT id, address FROM properties")).mappings().all()
        props = [ SimpleNamespace(**r) for r in rows ]

    results = {}

    # Limit concurrency to avoid exhausting provider connections
    semaphore = asyncio.Semaphore(int(os.getenv('AI_SYNC_CONCURRENCY', '6')))

    async def fetch_and_format(p):
        addr = getattr(p, 'address', None)
        if not addr:
            return (getattr(p, 'id', addr), { 'error': 'No address' })
        # Use per-session cache key so results are scoped to the requesting user
        key = f"user:{current_user.id}|addr:{addr.lower().strip()}"

        async with semaphore:
            try:
                # Prefer cached value if recent (session-scoped)
                cached = AI_CACHE.get(key)
                if cached and (time.time() - cached[1]) < AI_CACHE_TTL:
                    res_obj = cached[0]
                else:
                    res_obj = await asyncio.to_thread(get_property_update, addr)
                    if isinstance(res_obj, dict) and not res_obj.get('error'):
                        AI_CACHE[key] = (res_obj, time.time())
            except Exception as e:
                return (getattr(p, 'id', addr), { 'error': str(e) })

        status = (res_obj.get('status') or '').title() if res_obj and isinstance(res_obj, dict) else 'Unknown'
        sold_date = res_obj.get('sold_date') if isinstance(res_obj, dict) else None
        confidence = res_obj.get('confidence') if isinstance(res_obj, dict) else None
        short = status
        if sold_date:
            short += f" on {sold_date}"
        if confidence is not None:
            try:
                short += f" (confidence {float(confidence):.2f})"
            except Exception:
                pass

        indicator = None
        if status.lower() == 'sold':
            indicator = 'SOLD'
        elif status.lower() == 'active':
            indicator = 'ACTIVE'
        elif status.lower() == 'pending':
            indicator = 'PENDING'

        return (getattr(p, 'id', addr), {
            'address': addr,
            'status': status,
            'sold_date': sold_date,
            'confidence': confidence,
            'summary': short,
            'indicator': indicator
        })

    tasks = [ fetch_and_format(p) for p in props ]
    done = await asyncio.gather(*tasks)
    for k, v in done:
        results[k] = v

    return results


@app.get("/ai/models")
def ai_models(current_user: User = Depends(get_current_user)):
    """Return the list of detected available models and the currently configured model.
    This helps pick an alternative when you hit quota or Model NotFound errors.
    """
    # Groq-only diagnostics: list whether Groq is enabled and which model is configured
    return {"groq_enabled": bool(GROQ_CLIENT), "groq_model": GROQ_MODEL if GROQ_CLIENT else None}


@app.post("/ai/ask")
async def ai_ask(payload: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """General question-answer endpoint that can consult the database and use Groq to answer free-text questions.

    Request body: { "question": "..." }
    Response: { "answer": "..." }
    """
    question = None
    if payload and isinstance(payload, dict):
        question = payload.get('question') or payload.get('q')
    if not question:
        raise HTTPException(status_code=400, detail="Missing 'question' in request body")

    # Quick person lookup: if the user asked about a specific person, try to answer directly from DB
    try:
        import re
        m = re.search(r"who is\s+([\w\s'.-]+)\??", question, re.IGNORECASE)
        name_query = None
        if m:
            name_query = m.group(1).strip()
        else:
            # also handle 'tell me about NAME' pattern
            m2 = re.search(r"tell me about\s+([\w\s'.-]+)\??", question, re.IGNORECASE)
            if m2:
                name_query = m2.group(1).strip()

        if name_query:
            # search agents table first
            try:
                row = db.execute(text("SELECT id, name, email, phone FROM agents WHERE lower(name) LIKE :q LIMIT 1"), {"q": f"%{name_query.lower()}%"}).mappings().first()
                if row:
                    a = SimpleNamespace(**row)
                    # count properties for this agent if possible
                    try:
                        cnt = db.query(Property).filter((Property.agent == a.name) | (Property.agent_id == a.id)).count()
                    except Exception:
                        db.rollback()
                        cnt_row = db.execute(text("SELECT count(*) as c FROM properties WHERE lower(agent) LIKE :q OR agent_id = :id"), {"q": f"%{name_query.lower()}%", "id": a.id}).mappings().first()
                        cnt = int(cnt_row['c']) if cnt_row else 0
                    return { 'answer': f"Agent {a.name}: email {a.email or 'unknown'}, phone {a.phone or 'unknown'}. Associated properties: {cnt}." }
            except Exception:
                db.rollback()

            # also check photographers
            try:
                row = db.execute(text("SELECT id, name, email, phone FROM photographers WHERE lower(name) LIKE :q LIMIT 1"), {"q": f"%{name_query.lower()}%"}).mappings().first()
                if row:
                    p = SimpleNamespace(**row)
                    return { 'answer': f"Photographer {p.name}: email {p.email or 'unknown'}, phone {p.phone or 'unknown'}." }
            except Exception:
                db.rollback()

            # fallback: search users table
            try:
                row = db.execute(text("SELECT id, name, email FROM users WHERE lower(name) LIKE :q LIMIT 1"), {"q": f"%{name_query.lower()}%"}).mappings().first()
                if row:
                    u = SimpleNamespace(**row)
                    return { 'answer': f"User {u.name}: email {u.email or 'unknown'}." }
            except Exception:
                db.rollback()
        # continue to normal handling if no person found
    except Exception:
        # don't block assistant if lookup fails
        try:
            db.rollback()
        except Exception:
            pass

    # Quick property -> photographer lookup: handle questions like
    # "Who photographed 123 Main St?" or "Who shot 45 Elm Ave?"
    try:
        import re as _re
        m_addr = _re.search(r"who\s+(?:shot|photographed|took(?: the)? photos (?:for|of)|took photos of)\s+(.+?)\??$", question, _re.IGNORECASE)
        if m_addr:
            addr_q = m_addr.group(1).strip()
            try:
                row = db.execute(text(
                    "SELECT properties.address as address, p.id as photographer_id, p.name as photographer_name, p.email as photographer_email, p.phone as photographer_phone "
                    "FROM properties LEFT JOIN photographers p ON properties.photographer_id = p.id "
                    "WHERE lower(properties.address) LIKE :q LIMIT 1"
                ), {"q": f"%{addr_q.lower()}%"}).mappings().first()
                if row:
                    pr = SimpleNamespace(**row)
                    if pr.photographer_name:
                        return { 'answer': f"Photographer {pr.photographer_name} photographed {pr.address}: email {pr.photographer_email or 'unknown'}, phone {pr.photographer_phone or 'unknown'}." }
                    else:
                        return { 'answer': f"No photographer is assigned to {pr.address}." }
            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass

    # gather a small, privacy-minded snapshot of the database scoped to the user's company
    try:
        props_q = db.query(Property)
        if current_user and getattr(current_user, 'company', None):
            props_q = props_q.filter(Property.company == current_user.company)
        total_properties = props_q.count()
        # eager-load photographer relationship when available so we can report who shot each property
        sample_props = props_q.options().order_by(Property.id.desc()).limit(10).all()
    except ProgrammingError:
        db.rollback()
        # fallback textual queries; include joined photographer fields when possible
        total_row = db.execute(text("SELECT count(*) as c FROM properties")).mappings().first()
        total_properties = int(total_row['c']) if total_row else 0
        rows = db.execute(text(
            "SELECT properties.id, properties.address, properties.status, properties.price, properties.photographer_id, "
            "p.name as photographer_name, p.email as photographer_email, p.phone as photographer_phone "
            "FROM properties LEFT JOIN photographers p ON properties.photographer_id = p.id "
            "ORDER BY properties.id DESC LIMIT 10"
        )).mappings().all()
        sample_props = [ SimpleNamespace(**r) for r in rows ]

    try:
        agents_q = db.query(Agent)
        if current_user and getattr(current_user, 'company', None):
            agents_q = agents_q.filter(Agent.company == current_user.company)
        agents = agents_q.limit(20).all()
    except ProgrammingError:
        db.rollback()
        rows = db.execute(text("SELECT id, name, email, phone FROM agents LIMIT 20")).mappings().all()
        agents = [ SimpleNamespace(**r) for r in rows ]

    # also gather photographers so the assistant has access to photographer contacts
    try:
        photog_q = db.query(Photographer)
        if current_user and getattr(current_user, 'company', None):
            photog_q = photog_q.filter(Photographer.company == current_user.company)
        photographers = photog_q.limit(20).all()
    except ProgrammingError:
        db.rollback()
        rows = db.execute(text("SELECT id, name, email, phone FROM photographers LIMIT 20")).mappings().all()
        photographers = [ SimpleNamespace(**r) for r in rows ]

    # Gather recent statistics (last N rows) and simple aggregates
    stats_rows = []
    total_shoots = 0
    # total_income should be calculated from all logged statistics rows (not just the recent snapshot)
    total_income = 0.0
    avg_shoots_per_row = 0.0
    try:
        stats_q = db.query(Statistic).order_by(Statistic.date.desc())
        # scope stats to current user's company when present
        company = getattr(current_user, 'company', None)
        if company is not None:
            stats_q = stats_q.filter(Statistic.company == company)
        stats_q = stats_q.limit(90)
        stats_rows = stats_q.all()
        total_shoots = sum(int(getattr(s, 'shoots_count', 0) or 0) for s in stats_rows)
        # compute total income across all statistics rows in the DB, scoped to company when applicable
        total_query = db.query(func.coalesce(func.sum(Statistic.income_total), 0.0))
        if company is not None:
            total_query = total_query.filter(Statistic.company == company)
        total_income_all = total_query.scalar() or 0.0
        total_income = float(total_income_all)
        avg_shoots_per_row = (total_shoots / len(stats_rows)) if stats_rows else 0.0
    except ProgrammingError:
        db.rollback()
        # textual fallback: include company filter when available
        if company is not None:
            rows = db.execute(text("SELECT date, shoots_count, income_total FROM statistics WHERE company = :company ORDER BY date DESC LIMIT 90"), {"company": company}).mappings().all()
        else:
            rows = db.execute(text("SELECT date, shoots_count, income_total FROM statistics ORDER BY date DESC LIMIT 90")).mappings().all()
        stats_rows = [ SimpleNamespace(**r) for r in rows ]
        total_shoots = sum(int(r.get('shoots_count') or 0) for r in rows)
        # fallback: compute total income using textual SQL (scoped to company when possible)
        if company is not None:
            total_row = db.execute(text("SELECT COALESCE(SUM(income_total),0) as total FROM statistics WHERE company = :company"), {"company": company}).mappings().first()
        else:
            total_row = db.execute(text("SELECT COALESCE(SUM(income_total),0) as total FROM statistics")).mappings().first()
        total_income = float(total_row['total']) if total_row else 0.0
        avg_shoots_per_row = (total_shoots / len(rows)) if rows else 0.0

    # build a concise context string for the model
    ctx_lines = []
    ctx_lines.append(f"Total properties in scope: {total_properties}")
    if sample_props:
        ctx_lines.append("Sample properties (most recent):")
        for p in sample_props:
            addr = getattr(p, 'address', None) or getattr(p, 'addr', None) or '—'
            st = getattr(p, 'status', None) or 'Unknown'
            pr = getattr(p, 'price', None)
            pr_s = f"${float(pr):,.2f}" if pr is not None and str(pr) != 'None' else '—'
            # photographer info: prefer ORM relationship, fall back to joined fields
            phot = None
            try:
                phot_obj = getattr(p, 'photographer', None)
                if phot_obj and getattr(phot_obj, 'name', None):
                    phot = getattr(phot_obj, 'name')
            except Exception:
                phot = None
            if not phot:
                phot = getattr(p, 'photographer_name', None) or getattr(p, 'photographer', None) or '—'
            ctx_lines.append(f"- {addr} | status: {st} | price: {pr_s} | photographer: {phot}")
    if agents:
        ctx_lines.append("Agents (name — email — phone):")
        for a in agents[:20]:
            name = getattr(a, 'name', getattr(a, 'agent', None)) or '—'
            email = getattr(a, 'email', None) or '—'
            phone = getattr(a, 'phone', None) or '—'
            ctx_lines.append(f"- {name} — {email} — {phone}")

    # include photographers in the prompt context so Groq can answer photographer questions
    if 'photographers' in locals() and photographers:
        ctx_lines.append("Photographers (name — email — phone):")
        for p in photographers[:20]:
            pname = getattr(p, 'name', None) or '—'
            pemail = getattr(p, 'email', None) or '—'
            pphone = getattr(p, 'phone', None) or '—'
            ctx_lines.append(f"- {pname} — {pemail} — {pphone}")

    # include simple stats summary for model context
    if stats_rows:
        ctx_lines.append("Statistics (recent):")
        ctx_lines.append(f"- total_shoots: {total_shoots}")
        ctx_lines.append(f"- total_income: ${total_income:,.2f}")
        ctx_lines.append(f"- avg_shoots_per_period: {avg_shoots_per_row:.2f}")

    context_text = "\n".join(ctx_lines)

    # If Groq not configured, return a simple database-aware answer locally
    if not GROQ_CLIENT:
        # Simple heuristics for common questions
        qlow = question.lower()
        # quick stats answers
        if 'shoot' in qlow or 'income' in qlow or 'stat' in qlow or 'average' in qlow:
            return { 'answer': f"Recent stats: total_shoots={total_shoots}, total_income=${total_income:,.2f}, avg_shoots_per_period={avg_shoots_per_row:.2f}" }
        if 'how many' in qlow or 'total' in qlow or 'count' in qlow:
            return { 'answer': f"There are {total_properties} properties in your scoped dataset." }
        # try to match agent by name
        for a in agents:
            if a and getattr(a, 'name', '') and getattr(a, 'name', '').lower() in qlow:
                return { 'answer': f"Agent {a.name}: email {getattr(a,'email', 'unknown')}, phone {getattr(a,'phone','unknown')}" }
        # try to match photographer by name as well
        if 'photographers' in locals():
            for p in photographers:
                if p and getattr(p, 'name', '') and getattr(p, 'name', '').lower() in qlow:
                    return { 'answer': f"Photographer {p.name}: email {getattr(p,'email', 'unknown')}, phone {getattr(p,'phone','unknown')}" }
        return { 'answer': f"Groq not configured. Context snapshot:\n{context_text}\n\nQuestion: {question}\n\nI couldn't run the LLM but here's the context for debugging." }

    # Build prompt for Groq
    system_msg = (
        "You are a helpful assistant. Use the database snapshot provided to answer the user's question. "
        "If the user asks for contact details, return name, email and phone when available. "
        "If you cannot find an answer in the data, say you don't see that information. Be concise."
    )
    user_msg = f"Database snapshot:\n{context_text}\n\nQuestion: {question}\nAnswer:" 

    try:
        chat_completion = GROQ_CLIENT.chat.completions.create(
            messages=[{"role": "system", "content": system_msg}, {"role": "user", "content": user_msg}],
            model=GROQ_MODEL,
        )
        try:
            content = chat_completion.choices[0].message.content
        except Exception:
            content = getattr(chat_completion, 'text', None) or str(chat_completion)
        return { 'answer': content }
    except Exception as e:
        # fallback: return context and error
        return { 'error': str(e), 'context': context_text }


# ----- Statistics models & endpoints -----
class StatisticCreate(BaseModel):
    # optional date (YYYY-MM-DD). If omitted, server will use UTC today.
    date: str | None = None
    shoots_count: int = 0
    income_total: float = 0.0


@app.post("/stats", status_code=201)
def create_stat(s: StatisticCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # protected endpoint to record daily stats. Date is optional (YYYY-MM-DD string).
    try:
        if s.date:
            try:
                d = date.fromisoformat(s.date)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid date format, expected YYYY-MM-DD")
        else:
            d = datetime.utcnow().date()

        stat = Statistic(date=d, shoots_count=int(s.shoots_count), income_total=float(s.income_total), company=getattr(current_user, 'company', None))
        db.add(stat)
        db.commit()
        db.refresh(stat)
        return stat
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/stats/summary")
def stats_summary(days: int = 30, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # return timeseries of daily stats for the last `days` days (inclusive).
    # Fallback to textual select when the `statistics` table doesn't exist yet during rollouts.
    cutoff = datetime.utcnow().date() - timedelta(days=max(1, days - 1))
    try:
        q = db.query(Statistic).filter(Statistic.date >= cutoff)
        company = getattr(current_user, 'company', None)
        if company is not None:
            q = q.filter(Statistic.company == company)
        rows = q.order_by(Statistic.date).all()
        return rows
    except ProgrammingError:
        db.rollback()
        if getattr(current_user, 'company', None) is not None:
            rows = db.execute(text("SELECT id, date, shoots_count, income_total, created_at FROM statistics WHERE date >= :cutoff AND company = :company ORDER BY date"), {"cutoff": cutoff, "company": getattr(current_user, 'company', None)}).mappings().all()
        else:
            rows = db.execute(text("SELECT id, date, shoots_count, income_total, created_at FROM statistics WHERE date >= :cutoff ORDER BY date"), {"cutoff": cutoff}).mappings().all()
        return [dict(r) for r in rows]


    @app.get("/debug/stats_recent")
    def debug_stats_recent(limit: int = 50, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
        """Developer helper: return recent Statistic rows for the current user's company.

        Protected endpoint for debugging why statistics rows may not be visible to the UI.
        """
        try:
            company = getattr(current_user, 'company', None)
            q = db.query(Statistic).order_by(Statistic.created_at.desc())
            if company is not None:
                q = q.filter(Statistic.company == company)
            rows = q.limit(limit).all()
            out = []
            for r in rows:
                out.append({
                    'id': r.id,
                    'date': r.date.isoformat() if getattr(r, 'date', None) is not None else None,
                    'shoots_count': int(getattr(r, 'shoots_count', 0) or 0),
                    'income_total': float(getattr(r, 'income_total', 0.0) or 0.0),
                    'company': getattr(r, 'company', None),
                    'created_at': getattr(r, 'created_at', None).isoformat() if getattr(r, 'created_at', None) is not None else None
                })
            return { 'user': { 'id': current_user.id, 'name': current_user.name, 'company': company }, 'rows': out }
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

# ----------------------
# Existing properties endpoints
# ----------------------
@app.get("/properties")
def get_properties(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # SaaS: only return properties that belong to the current user's company
    company = getattr(current_user, 'company', None)
    try:
        q = db.query(Property)
        if company is not None:
            q = q.filter(Property.company == company)
        return q.all()
    except ProgrammingError:
        db.rollback()
        # try to include `paid` and `image_url` if the columns exist; if not, fall back to a select
        # that does not reference `image_url` to remain compatible with older schemas.
        try:
            if company is not None:
                rows = db.execute(text("SELECT id, address, status, price, agent, company, paid, image_url FROM properties WHERE company = :company"), {"company": company}).mappings().all()
            else:
                rows = db.execute(text("SELECT id, address, status, price, agent, company, paid, image_url FROM properties")).mappings().all()
            return [dict(r) for r in rows]
        except ProgrammingError:
            db.rollback()
            # final safe fallback: do not reference `image_url` (it may not exist yet)
            if company is not None:
                rows = db.execute(text("SELECT id, address, status, price, agent, company FROM properties WHERE company = :company"), {"company": company}).mappings().all()
            else:
                rows = db.execute(text("SELECT id, address, status, price, agent, company FROM properties")).mappings().all()
            out = [dict(r) for r in rows]
            # ensure `paid` and `image_url` keys exist for frontend convenience
            for o in out:
                o.setdefault('paid', False)
                o.setdefault('image_url', None)
            return out

@app.post("/properties", status_code=201)
def create_property(prop_data: PropertyCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # creation requires authentication; you can store current_user.id as created_by if you extend model
    # ensure created properties are tied to the user's company (SaaS multi-tenant)
    company = getattr(current_user, 'company', None)
    new_prop = Property(
        address=prop_data.address,
        status=prop_data.status,
        price=prop_data.price,
        agent=prop_data.agent,
        photographer_id=prop_data.photographer_id,
        company=prop_data.company or company,
        image_url=prop_data.image_url
    )
    db.add(new_prop)
    db.commit()
    db.refresh(new_prop)
    return new_prop
 

# Get a single property by id (public read)
@app.get("/properties/{property_id}")
def get_property(property_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # SaaS: only allow viewing properties in the same company
    company = getattr(current_user, 'company', None)
    try:
        q = db.query(Property).filter(Property.id == property_id)
        if company is not None:
            q = q.filter(Property.company == company)
        prop = q.first()
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")
        return prop
    except ProgrammingError:
        db.rollback()
        # attempt textual selects; include company constraint when possible
        try:
            if company is not None:
                row = db.execute(text("SELECT id, address, status, price, agent, company, photographer_id, paid, image_url FROM properties WHERE id = :id AND company = :company LIMIT 1"), {"id": property_id, "company": company}).mappings().first()
            else:
                row = db.execute(text("SELECT id, address, status, price, agent, company, photographer_id, paid, image_url FROM properties WHERE id = :id LIMIT 1"), {"id": property_id}).mappings().first()
            if not row:
                raise HTTPException(status_code=404, detail="Property not found")
            r = dict(row)
            return r
        except ProgrammingError:
            db.rollback()
            if company is not None:
                row = db.execute(text("SELECT id, address, status, price, agent, company, photographer_id FROM properties WHERE id = :id AND company = :company LIMIT 1"), {"id": property_id, "company": company}).mappings().first()
            else:
                row = db.execute(text("SELECT id, address, status, price, agent, company, photographer_id FROM properties WHERE id = :id LIMIT 1"), {"id": property_id}).mappings().first()
            if not row:
                raise HTTPException(status_code=404, detail="Property not found")
            r = dict(row)
            r.setdefault('paid', False)
            r.setdefault('image_url', None)
            return r


# Mark property as paid/unpaid (protected)
@app.post("/properties/{property_id}/paid")
def set_property_paid(property_id: int, paid_update: PaidUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        # ensure property belongs to current user's company
        company = getattr(current_user, 'company', None)
        q = db.query(Property).filter(Property.id == property_id)
        if company is not None:
            q = q.filter(Property.company == company)
        prop = q.first()
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")
        old_paid = bool(prop.paid)
        new_paid = bool(paid_update.paid)

        # update the property paid flag
        prop.paid = new_paid

        # When marking paid, create a Statistic entry (one row per paid listing).
        # When unmarking paid, remove one matching Statistic entry for today if present.
        try:
            today = date.today()
            price_val = float(prop.price or 0.0)

            if not old_paid and new_paid:
                # Insert one Statistic row representing this property's paid event
                stat = Statistic(date=today, shoots_count=1, income_total=price_val, company=company)
                db.add(stat)

            elif old_paid and not new_paid:
                # Try to remove one Statistic row that most likely matches this property's payment
                # Prefer an exact match on date and income_total and shoots_count == 1, newest first
                match_q = db.query(Statistic).filter(
                    Statistic.date == today,
                    Statistic.income_total == price_val,
                    Statistic.shoots_count == 1
                )
                if company is not None:
                    match_q = match_q.filter(Statistic.company == company)
                match = match_q.order_by(Statistic.created_at.desc()).first()

                if match:
                    db.delete(match)
                else:
                    # Fallback: if no exact per-listing row found, attempt to decrement an aggregate row
                    agg_q = db.query(Statistic).filter(Statistic.date == today)
                    if company is not None:
                        agg_q = agg_q.filter(Statistic.company == company)
                    agg = agg_q.first()
                    if agg:
                        agg.shoots_count = max(0, int((agg.shoots_count or 0) - 1))
                        agg.income_total = max(0.0, float((agg.income_total or 0.0) - price_val))
                        db.add(agg)
        except Exception:
            # do not block the paid update if stats fail; rollback stat changes if needed
            try:
                db.rollback()
            except Exception:
                pass

        db.add(prop)
        db.commit()
        db.refresh(prop)
        return {"id": prop.id, "paid": prop.paid}
    except ProgrammingError:
        db.rollback()
        # If the `paid` column doesn't exist, inform the client
        raise HTTPException(status_code=400, detail="Paid flag not available on the database. Run migrations to add the column.")
 

# ----------------------
# Update property (protected)
# ----------------------
@app.patch("/properties/{property_id}")
def update_property(property_id: int, prop_up: PropertyUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        # ensure property belongs to current user's company
        company = getattr(current_user, 'company', None)
        q = db.query(Property).filter(Property.id == property_id)
        if company is not None:
            q = q.filter(Property.company == company)
        prop = q.first()
        if not prop:
            raise HTTPException(status_code=404, detail="Property not found")

        # Only update fields that are present in payload
        if prop_up.address is not None:
            prop.address = prop_up.address
        if prop_up.status is not None:
            prop.status = prop_up.status
        if prop_up.price is not None:
            prop.price = float(prop_up.price)
        if prop_up.agent is not None:
            prop.agent = prop_up.agent
        if prop_up.company is not None:
            prop.company = prop_up.company
        if prop_up.photographer_id is not None:
            prop.photographer_id = prop_up.photographer_id
        if prop_up.paid is not None:
            old_paid = bool(prop.paid)
            new_paid = bool(prop_up.paid)
            prop.paid = new_paid
            # mirror statistics behavior when paid flag changes via PATCH
            try:
                today = date.today()
                price_val = float(prop.price or 0.0)
                if not old_paid and new_paid:
                    stat = Statistic(date=today, shoots_count=1, income_total=price_val, company=company)
                    db.add(stat)
                elif old_paid and not new_paid:
                    match_q = db.query(Statistic).filter(
                        Statistic.date == today,
                        Statistic.income_total == price_val,
                        Statistic.shoots_count == 1
                    )
                    if company is not None:
                        match_q = match_q.filter(Statistic.company == company)
                    match = match_q.order_by(Statistic.created_at.desc()).first()
                    if match:
                        db.delete(match)
                    else:
                        agg_q = db.query(Statistic).filter(Statistic.date == today)
                        if company is not None:
                            agg_q = agg_q.filter(Statistic.company == company)
                        agg = agg_q.first()
                        if agg:
                            agg.shoots_count = max(0, int((agg.shoots_count or 0) - 1))
                            agg.income_total = max(0.0, float((agg.income_total or 0.0) - price_val))
                            db.add(agg)
            except Exception:
                try:
                    db.rollback()
                except Exception:
                    pass
        if prop_up.image_url is not None:
            prop.image_url = prop_up.image_url

        db.add(prop)
        db.commit()
        db.refresh(prop)
        return prop
    except ProgrammingError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database schema not compatible with update. Run migrations.")


# ----------------------
# Photographers endpoints
# ----------------------
@app.get("/photographers")
def list_photographers(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Only return photographers for the current user's company
    company = getattr(current_user, 'company', None)
    try:
        q = db.query(Photographer)
        if company is not None:
            q = q.filter(Photographer.company == company)
        return q.all()
    except ProgrammingError:
        db.rollback()
        if company is not None:
            rows = db.execute(text("SELECT id, name, email, phone, company, created_at FROM photographers WHERE company = :company"), {"company": company}).mappings().all()
        else:
            rows = db.execute(text("SELECT id, name, email, phone, company, created_at FROM photographers")).mappings().all()
        return [dict(r) for r in rows]


@app.post("/photographers", status_code=201)
def create_photographer(p: PhotographerCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # require auth to create photographers
    # basic uniqueness check by email if provided
    if p.email:
        exists = db.query(Photographer).filter(Photographer.email == p.email).first()
        if exists:
            raise HTTPException(status_code=400, detail="Photographer with that email already exists")
    # ensure photographer is assigned to the current user's company
    company = getattr(current_user, 'company', None)
    new_p = Photographer(name=p.name, email=p.email, phone=p.phone, company=p.company or company)
    db.add(new_p)
    db.commit()
    db.refresh(new_p)
    return new_p


@app.delete("/photographers/{photographer_id}")
def delete_photographer(photographer_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ph = db.query(Photographer).filter(Photographer.id == photographer_id).first()
    if not ph:
        raise HTTPException(status_code=404, detail="Photographer not found")
    # ensure company matches
    company = getattr(current_user, 'company', None)
    if company is not None and ph.company != company:
        raise HTTPException(status_code=404, detail="Photographer not found")
    # optionally reassign or nullify photographer_id on properties that reference this photographer
    props = db.query(Property).filter(Property.photographer_id == ph.id).all()
    for pr in props:
        # only clear on properties in same company
        try:
            if company is None or pr.company == company:
                pr.photographer_id = None
        except Exception:
            pr.photographer_id = None
    db.delete(ph)
    db.commit()
    return {"message": "deleted"}


# ----------------------
# Agents endpoints
# ----------------------
@app.get("/agents")
def list_agents(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Only return agents for the current user's company
    company = getattr(current_user, 'company', None)
    try:
        q = db.query(Agent)
        if company is not None:
            q = q.filter(Agent.company == company)
        return q.all()
    except ProgrammingError:
        db.rollback()
        if company is not None:
            rows = db.execute(text("SELECT id, name, email, phone, company, created_at FROM agents WHERE company = :company"), {"company": company}).mappings().all()
        else:
            rows = db.execute(text("SELECT id, name, email, phone, company, created_at FROM agents")).mappings().all()
        return [dict(r) for r in rows]


@app.post("/agents", status_code=201)
def create_agent(a: AgentCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # require auth to create agents
    if not a.name or not a.name.strip():
        raise HTTPException(status_code=400, detail="Agent name is required")
    # basic uniqueness by name (case-insensitive)
    exists = None
    try:
        exists = db.query(Agent).filter(Agent.name.ilike(a.name.strip())).first()
    except Exception:
        db.rollback()
    if exists:
        raise HTTPException(status_code=400, detail="Agent with that name already exists")
    # assign to current user's company by default
    company = getattr(current_user, 'company', None)
    new_a = Agent(name=a.name.strip(), email=a.email, phone=a.phone, company=a.company or company)
    db.add(new_a)
    db.commit()
    db.refresh(new_a)
    return new_a


@app.get("/agents/{agent_id}")
def get_agent(agent_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    company = getattr(current_user, 'company', None)
    ag = db.query(Agent).filter(Agent.id == agent_id).first()
    if not ag or (company is not None and ag.company != company):
        raise HTTPException(status_code=404, detail="Agent not found")
    return ag


@app.patch("/agents/{agent_id}")
def update_agent(agent_id: int, a_up: AgentUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    company = getattr(current_user, 'company', None)
    ag = db.query(Agent).filter(Agent.id == agent_id).first()
    if not ag or (company is not None and ag.company != company):
        raise HTTPException(status_code=404, detail="Agent not found")
    if a_up.name is not None:
        ag.name = a_up.name
    if a_up.email is not None:
        ag.email = a_up.email
    if a_up.phone is not None:
        ag.phone = a_up.phone
    # always keep agent tied to the user's company
    ag.company = company or ag.company
    db.add(ag)
    db.commit()
    db.refresh(ag)
    return ag


@app.delete("/agents/{agent_id}")
def delete_agent(agent_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    company = getattr(current_user, 'company', None)
    ag = db.query(Agent).filter(Agent.id == agent_id).first()
    if not ag or (company is not None and ag.company != company):
        raise HTTPException(status_code=404, detail="Agent not found")
    # clear agent names on properties that referenced this agent by name, but only within same company
    props = db.query(Property).filter(Property.agent == ag.name).all()
    for pr in props:
        try:
            if company is None or pr.company == company:
                pr.agent = None
        except Exception:
            pr.agent = None
    db.delete(ag)
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
