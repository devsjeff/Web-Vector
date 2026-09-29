from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    token: str


class Email(BaseModel):
    email: EmailStr


class LoginType(BaseModel):
    email: EmailStr
    password: str


class SignupType(BaseModel):
    otp: str = Field(min_length=6, max_length=6)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    first_name: str | None = Field(default=None, max_length=20)
    last_name: str | None = Field(default=None, max_length=20)


class Configs_type (BaseModel):

    wtAcc: str = Field(min_length=12 , max_length=12 )
    email: str = Field(min_length=5 , max_length=50)
    role_identity :str |None = Field(default="default")
    memory_Context :str |None = Field(default="default")
    rules_instructions :str |None = Field(default="default")
    response_Style :str |None = Field(default="default")
    task :str |None = Field(default="default")