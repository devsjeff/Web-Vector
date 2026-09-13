from pydantic import BaseModel , EmailStr ,Field

class Token (BaseModel):
    token :str
    

class Email (BaseModel):
    email : EmailStr
    
    
class LoginType (BaseModel):
    email : EmailStr                           
    password : str
                    
                                     
class SignupType (BaseModel):
    otp : str = Field(min_length=6 ,max_length=6)
    email : EmailStr 
    password : str =  Field(min_length=6 , max_length=128)

#                         !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!