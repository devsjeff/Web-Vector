from typing import Annotated

from pydantic import BaseModel, EmailStr, Field, StringConstraints, model_validator


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


# ------------------------------------------------------------------ WhatsApp assistant settings
# The names below (roleIdentity, memoryContext, ...) are exactly what settings.tsx sends.


class FieldState(BaseModel):
    """One dropdown (mode) + optional free text (used when mode == "custom")."""

    mode: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    customText: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""

    @model_validator(mode="after")
    def custom_needs_text(self):
        if self.mode == "custom" and not self.customText:
            raise ValueError("customText is required when mode is 'custom'")
        return self


class Configs_type(BaseModel):
    language: FieldState
    roleIdentity: FieldState
    memoryContext: FieldState
    rulesInstructions: FieldState
    responseStyle: FieldState
    task: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=3000)]


class ContactConfigType(BaseModel):
    whatsappNumber: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=50)]
    contactName: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)] = ""
    enabled: bool = True
    toneStyle: Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)] = "sarcastic"
    language: FieldState | None = None
    roleIdentity: FieldState | None = None
    memoryContext: FieldState | None = None
    rulesInstructions: FieldState | None = None
    responseStyle: FieldState | None = None
    task: Annotated[str, StringConstraints(strip_whitespace=True, max_length=3000)] = ""
    notes: Annotated[str, StringConstraints(strip_whitespace=True, max_length=3000)] = ""


class MemoryCreateType(BaseModel):
    whatsappNumber: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=50)]
    memoryText: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]


class ContactNameSyncType(BaseModel):
    whatsappNumber: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=50)]
    contactName: Annotated[str, StringConstraints(strip_whitespace=True, max_length=100)]

