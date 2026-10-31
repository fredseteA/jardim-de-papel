from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path
from unittest.mock import patch
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable
from app.models import Base

def test_initial_migration_is_create_only_on_upgrade():
    path = Path(__file__).parents[1] / 'alembic' / 'versions' / '0001_initial.py'
    spec = spec_from_file_location('initial_migration', path)
    migration = module_from_spec(spec)
    spec.loader.exec_module(migration)
    statements = []
    with patch.object(migration.op, 'execute', side_effect=statements.append):
        migration.upgrade()
    assert len(statements) >= len(Base.metadata.tables)
    assert all(sql.lstrip().upper().startswith(('CREATE TABLE', 'CREATE INDEX', 'CREATE UNIQUE INDEX')) for sql in statements)
    assert len([sql for sql in statements if sql.lstrip().upper().startswith('CREATE TABLE')]) == 11
    for table in Base.metadata.sorted_tables:
        if table.name == 'users':
            # The initial migration predates the subsequent role column.
            assert any(sql.startswith('CREATE TABLE users (') for sql in statements)
            continue
        assert str(CreateTable(table).compile(dialect=postgresql.dialect())).strip() in statements
