import os
from dotenv import load_dotenv
load_dotenv()  # load .env before reading DATABASE_URL or SECRET_KEY

# SQLAlchemy imports for engine, model and session setup
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

# 1) Read DB URL from env and validate it
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    # Fail fast with a helpful error if env isn't configured
    raise RuntimeError("DATABASE_URL is not set in environment (.env). Set DATABASE_URL to your Neon/PG URL.")

# 2) Create engine (pool_pre_ping helps with intermittent connections on cloud DBs)
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# 3) Session factory used by FastAPI dependency
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4) Declarative base for model classes
Base = declarative_base()

# 5) Property model/table
class Property(Base):
    __tablename__ = "properties"
    id = Column(Integer, primary_key=True, index=True)           # primary key
    address = Column(String, nullable=False)                     # property address
    status = Column(String, default="Active", nullable=False)    # status (Active/Pending/Sold)
    price = Column(Float, default=0.0)                          # numeric price
    agent = Column(String, nullable=True)                        # agent name (optional)

    def __repr__(self):
        return f"<Property id={self.id} address={self.address!r}>"

# 6) User model/table for auth
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)           # primary key
    name = Column(String(150), nullable=False, index=True)       # username (indexed for lookups)
    email = Column(String(255), unique=True, nullable=True)      # optional unique email
    hashed_password = Column(String, nullable=False)             # store hashed password only
    created_at = Column(DateTime, default=datetime.utcnow)       # creation timestamp (UTC)

    def __repr__(self):
        return f"<User id={self.id} name={self.name!r}>"

# 7) Ensure tables exist (for simple setups). For production use Alembic migrations instead.
Base.metadata.create_all(bind=engine)