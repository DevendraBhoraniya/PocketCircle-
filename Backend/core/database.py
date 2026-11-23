import re
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.schema import CheckConstraint
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
    AsyncSession,
)
from sqlalchemy.orm import DeclarativeBase
from core.config import settings


@compiles(CheckConstraint, "sqlite")
def compile_check_constraint_sqlite(element, compiler, **kw):
    sql_text = getattr(element.sqltext, "text", str(element.sqltext))
    # Transform Postgres-specific regex operator '~' into valid SQLite syntax for local/CI test engines
    sql_text = re.sub(r"pocket_id\s*~\s*'[^']+'", "length(pocket_id) = 10", sql_text)
    name = compiler.preparer.quote(element.name) if element.name else ""
    return f"CONSTRAINT {name} CHECK ({sql_text})" if name else f"CHECK ({sql_text})"


engine_kwargs: dict = {
    "echo": False,
}

if "sqlite" in settings.DATABASE_URL:
    from sqlalchemy.pool import StaticPool
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    engine_kwargs["poolclass"] = StaticPool
else:
    engine_kwargs.update(
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        pool_timeout=30,
        pool_recycle=300,
    )

engine = create_async_engine(
    settings.DATABASE_URL,
    **engine_kwargs,
)

if "sqlite" in settings.DATABASE_URL:
    from sqlalchemy import event
    @event.listens_for(engine.sync_engine, "connect")
    def register_sqlite_functions(dbapi_connection, connection_record):
        dbapi_connection.create_function("least", -1, min, deterministic=True)
        dbapi_connection.create_function("greatest", -1, max, deterministic=True)


SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with SessionLocal() as session:
        yield session