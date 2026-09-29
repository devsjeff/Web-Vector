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


from pydantic import BaseModel

class FieldState(BaseModel):
    mode: str
    customText: str = ""

class Configs_type(BaseModel):
    language: FieldState
    roleIdentity: FieldState
    memoryContext: FieldState
    rulesInstructions: FieldState
    responseStyle: FieldState
    task: str = ""