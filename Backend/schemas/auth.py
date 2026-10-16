from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


class GoogleLoginRequest(BaseModel):
    credential: str


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
