from contextlib import asynccontextmanager

from fastapi import FastAPI

from core.database import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()
