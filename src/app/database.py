from dotenv import load_dotenv
load_dotenv()  # load .env before reading DATABASE_URL or SECRET_KEY

import os

# SQLAlchemy imports for engine, model and session setup
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, ForeignKey, Date, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

# 1) Read DB URL from env and validate it
# fall back to a local sqlite DB for dev if DATABASE_URL is not set
DATABASE_URL = os.getenv("DATABASE_URL") or "sqlite:///./dev.db"

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
    # optional company associated with the property (e.g., brokerage or client company)
    company = Column(String, nullable=True)
    # optional image URL for the listing (frontend may show this if present)
    image_url = Column(String, nullable=True)
    # reference to a photographer (optional)
    photographer_id = Column(Integer, ForeignKey('photographers.id'), nullable=True)
    photographer = relationship('Photographer', back_populates='properties', lazy='joined')
    # whether the property has been paid/invoiced
    paid = Column(Boolean, default=False, nullable=False)

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
    # optional company for users (e.g., photographer/company affiliation)
    company = Column(String, nullable=True)

    def __repr__(self):
        return f"<User id={self.id} name={self.name!r}>"

# 7) Ensure tables exist (for simple setups). For production use Alembic migrations instead.
Base.metadata.create_all(bind=engine)

# Photographer model: separate table for photographers to associate with properties
class Photographer(Base):
    __tablename__ = 'photographers'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True)
    phone = Column(String(50), nullable=True)
    company = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # reverse relationship to properties
    properties = relationship('Property', back_populates='photographer')

# Statistics table: store daily aggregates for shoots and income so the UI can
# render historical trends and averages. We keep it minimal and append-only.
class Statistic(Base):
    __tablename__ = 'statistics'
    id = Column(Integer, primary_key=True, index=True)
    # store the calendar date for the stat (UTC date portion is fine)
    date = Column(Date, nullable=False, index=True)
    shoots_count = Column(Integer, default=0)
    income_total = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

# Recreate tables (will add missing tables/columns). For production use Alembic instead.
Base.metadata.create_all(bind=engine)