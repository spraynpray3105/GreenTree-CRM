import os
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv() # Loads your Neon URL from a .env file

# 1. Setup Connection
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 2. Define the Property Table
class Property(Base):
    __tablename__ = "properties"
    id = Column(Integer, primary_key=True, index=True)
    address = Column(String)
    status = Column(String, default="Active")
    price = Column(Float)
    agent = Column(String)

# 3. Create the table in Neon
Base.metadata.create_all(bind=engine)