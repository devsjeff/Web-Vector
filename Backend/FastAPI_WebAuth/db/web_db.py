from sqlalchemy import create_engine , column 
from sqlalchemy.orm import mapped_column ,Mapped ,Session ,declarative_base

import os 
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)


class Base (declarative_base):
    pass


if not DATABASE_URL:
    raise RuntimeError ("Database url is missing")


