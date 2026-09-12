from sqlalchemy import create_engine , String 
from sqlalchemy.orm import mapped_column ,Mapped ,Session , DeclarativeBase
from sqlalchemy.exc import SQLAlchemyError ,IntegrityError

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
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    name :Mapped[str] = mapped_column(String(20),nullable=True)
    last_name :Mapped[str] = mapped_column(String(20),nullable=True)
    email :Mapped[str]  = mapped_column(String(50) , unique=True,nullable=False)  
    password : Mapped[str] = mapped_column(String(255) , nullable=False)



Base.metadata.create_all(engine)


def check_user_exists(email):
    with Session(engine) as Session_use:
        try:
            
            EmailExist = Session_use.query(DatabaseSchema).filter(DatabaseSchema.email == email).first()
            if not EmailExist:
                return {"operation_success":True , "UserExist":False}
            else :
                return {"operation_success":True , "UserExist":True}
        except SQLAlchemyError as e :
             return {"operation_success":False , "error": str(e)}
        
        
       
    

def create_user_account (email , password):
    with Session (engine) as Session_use :
        try :
            Create_User = DatabaseSchema(email = email , password = password)
            Session_use.add(Create_User)
            Session_use.commit()
            return  {"operation_success":True}
        except IntegrityError:
            return {"operation_success": False, "error": "email_already_exists"}
        except SQLAlchemyError as e :
            return {"operation_success":False , "error": str(e)}

    
