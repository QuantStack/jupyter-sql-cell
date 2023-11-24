import pytest
from pathlib import Path
from jupyter_sql_cell.sqlconnector import SQLConnector

def teardown_function():
    SQLConnector.databases = []


@pytest.fixture
def db_path() -> Path:
    return Path(__file__).parent / "data" / "world.sqlite"


@pytest.fixture
def add_database(db_path):
    SQLConnector.add_database({
        "alias": "default",
        "database": str(db_path),
        "dbms": "sqlite",
        "driver": None,
        "host": None,
        "port": None
    })


@pytest.fixture
def add_sync_database(db_path):
    SQLConnector.add_database({
      "alias": "default",
      "database": str(db_path),
      "dbms": "sqlite",
      "driver": "pysqlite",
      "host": None,
      "port": None
    })


"""
Should create an SqlConnector object without database.
"""
async def test_sql_connector_init():
    assert len(SQLConnector.databases) == 0
    connector = SQLConnector(0)
    assert type(connector) == SQLConnector
    assert len(connector.databases) == 0
    assert len(connector.errors) == 1
    assert "no registered database with id 0" in connector.errors[0]


"""
Should add a default driver.
"""
async def test_sql_connector_without_driver(add_database):
    assert len(SQLConnector.databases) == 1
    connector = SQLConnector(0)
    assert len(connector.errors) == 0


"""
Should add a sync database.
"""
async def test_sql_connector_with_sync_driver(add_sync_database):
    assert len(SQLConnector.databases) == 1
    connector = SQLConnector(0)
    assert len(connector.errors) == 0


"""
Should return tables list on async database.
"""
async def test_schema_tables(add_database):
    connector = SQLConnector(0)
    schema = await connector.get_schema("tables")
    assert len(schema) == 1
    assert schema == ["world"]


"""
Should return tables list on sync database.
"""
async def test_schema_tables_sync(add_sync_database):
    connector = SQLConnector(0)
    schema = await connector.get_schema("tables")
    assert len(schema) == 1
    assert schema == ["world"]


"""
Should return columns list on async database.
"""
async def test_schema_columns(add_database):
    connector = SQLConnector(0)
    schema = await connector.get_schema("columns", "world")
    assert len(schema) == 35
    assert "Abbreviation" in schema


"""
Should return columns list on sync database.
"""
async def test_schema_columns_sync(add_sync_database):
    connector = SQLConnector(0)
    schema = await connector.get_schema("columns", "world")
    assert len(schema) == 35
    assert "Abbreviation" in schema
