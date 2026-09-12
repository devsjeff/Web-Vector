from sqlalchemy import create_engine , String
from sqlalchemy.orm import mapped_column ,Mapped ,Session , DeclarativeBase

import os 
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError ("Database url is missing")

engine = create_engine(DATABASE_URL)


class Base (DeclarativeBase):
    pass



#DB_models

class DatabaseSchema(Base):
    __table__ = "Users"
    
    name(map) = mapped_column[str]
    lastname
    




