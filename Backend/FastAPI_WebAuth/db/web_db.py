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



#DB_model

class DatabaseSchema(Base):
    __tablename__ = "Users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name :Mapped[str] = mapped_column(String(20),nullable=True)
    last_name :Mapped[str] = mapped_column(String(20),nullable=True)
    email :Mapped[str]  = mapped_column(String(50) )  
    password : Mapped[str] = mapped_column(String(100))



Base.metadata.create_all(engine)



DBSession = Session(bind=engine)



def CheckUserExistOrNot(email):
    EmailExist = DBSessionSession.query(DatabaseSchema).filter(DatabaseSchema.email == email).first()
    if EmailExist:return True
    else :return False
    

def CreateUserAccount (email , password):
    Create = Session.query