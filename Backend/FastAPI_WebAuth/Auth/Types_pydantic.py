from pydantic import BaseModel , EmailStr

class Token (BaseModel):
    token :str
    

class Email (BaseModel):
    email :str
    
    
class LoginType (BaseModel):
    email : EmailStr                           
    password : str
                    
                                     
class SignupType (BaseModel):
    name :str
    lastname : str
    otp : str
    email : EmailStr
    password : str

#                         !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!