import re
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.schema import CheckConstraint

class Base(DeclarativeBase):
    pass

@compiles(CheckConstraint, "sqlite")
def compile_check_constraint_sqlite(element, compiler, **kw):
    sql_text = getattr(element.sqltext, "text", str(element.sqltext))
    # Transform Postgres-specific regex operator '~' into valid SQLite syntax
    sql_text = re.sub(r"pocket_id\s*~\s*'[^']+'", "length(pocket_id) = 10", sql_text)
    name = compiler.preparer.quote(element.name) if element.name else ""
    return f"CONSTRAINT {name} CHECK ({sql_text})" if name else f"CHECK ({sql_text})"
