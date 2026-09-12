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
    email :Mapped[str]  = mapped_column(String(50) , nullable=False)  
    password : Mapped[str] = mapped_column(String(100) , nullable=False)



Base.metadata.create_all(engine)


def CheckUserExistOrNot(email):
    
    try:
        Session_use = Session(bind=engine)
        EmailExist = Session_use.query(DatabaseSchema).filter(DatabaseSchema.email == email).first()
        if not EmailExist:
            return {"operation_success":True , "UserExist":False}
        else :
            return {"operation_success":True , "UserExist":True}
    except:
        return {"operation_success":False}
    finally :
        Session_use.close()
        
       
    

def CreateUserAccount (email , password):
    try :
        Session_use  = Session(bind=engine)
        Create_User = DatabaseSchema(email = email , password = password)
        Session_use.add(Create_User)
        Session_use.commit()
        return  {"operation_success":True}
    except:
         Session_use.rollback()
         return {"operation_success":False}
    finally:
        Session_use.close()
    
