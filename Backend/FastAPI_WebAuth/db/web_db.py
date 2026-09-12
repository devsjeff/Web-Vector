from sqlalchemy import create_engine , column 
from sqlalchemy.orm import mapped_column ,Mapped ,Session , DeclarativeBase

import os 
from dotenv import load_dotenv
 import logging

load_dotenv()
logging.basicConfig(level=)

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError ("Database url is missing")

engine = create_engine(DATABASE_URL)


class Base (DeclarativeBase):
    pass




