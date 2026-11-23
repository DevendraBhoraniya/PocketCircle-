from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class GoogleLoginRequest(BaseModel):
    credential: str


class EmailPasswordLoginRequest(BaseModel):
    email: EmailStr
    password: str


class EmailPasswordRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: str


class ResendOtpRequest(BaseModel):
    email: EmailStr


class OtpSentResponse(BaseModel):
    message: str
    email: EmailStr
    otp_required: bool = True
    dev_otp: str | None = None
    delivery_status: str | None = None
    sandbox_warning: str | None = None


class PublicUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: EmailStr
    username: str | None
    pocket_id: str
    avatar_url: str | None


class AuthenticatedUserResponse(BaseModel):
    message: str
    user: PublicUser


class SessionResponse(BaseModel):
    message: str


class UserSearchResponse(BaseModel):
    users: list[PublicUser]
