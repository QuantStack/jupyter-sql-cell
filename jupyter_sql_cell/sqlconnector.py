from sqlalchemy.exc import InvalidRequestError, NoSuchModuleError
from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine
from sqlalchemy import CursorResult, Inspector, URL, create_engine, inspect, text
from typing import Any, Dict, List, Optional, TypedDict

ASYNC_DRIVERS = {
    "mariadb": ["asyncmy", "aiomysql"],
    "mysql": ["asyncmy", "aiomysql"],
    "postgres": ["asyncpg", "psycopg"],
    "sqlite": ["aiosqlite"],
}


class DatabaseDesc(TypedDict):
    alias: Optional[str]
    database: str
    dbms: str
    driver: Optional[str]
    host: Optional[str]
    port: Optional[int]


class Database(TypedDict):
    alias: str
    id: int
    is_async: bool
    url: URL


class DatabaseSummary(DatabaseDesc):
    id: int
    is_async: bool


class SQLConnector:

    databases: [Database] = []
    warnings = []

    def __init__(self, database_id: int):
        self.engine = None
        self.errors = []
        self.database: Database = next(filter(lambda db: db["id"] == database_id, self.databases), None)

        if not self.database:
            self.errors.append(f"There is no registered database with id {database_id}")
        else:
            if self.database["is_async"]:
                self.engine = create_async_engine(self.database["url"])
            else:
                self.engine = create_engine(self.database["url"])

    async def get_schema(self, target: str, table: str = "") -> [str]:
        if self.database["is_async"]:
            async with self.engine.connect() as conn:
                schema = await conn.run_sync(self.use_inspector, target, table)
        else:
            with self.engine.connect() as conn:
                schema = self.use_inspector(conn, target, table)
        return schema

    def use_inspector(self, conn: AsyncConnection, target: str, table: str) -> [str]:
        inspector: Inspector = inspect(conn)
        if target == "tables":
            return inspector.get_table_names()
        elif target == "columns":
            columns = inspector.get_columns(table)
            return sorted([column['name'] for column in columns])

    async def execute(self, query: str) -> str:
        if not self.engine:
            return "SQL engine has not been created"
        cursor: CursorResult[Any] = await self.execute_request(query)

        return self.to_list(cursor)

    async def execute_request(self, query: str) -> CursorResult[Any]:
        async with self.engine.connect() as connection:
            cursor: CursorResult[Any] = await connection.execute(text(query))
            return cursor

    @classmethod
    def add_database(cls, db_desc: DatabaseDesc):
        id = 0
        if cls.databases:
            id = max([db["id"] for db in cls.databases]) + 1

        if db_desc["alias"]:
            alias = db_desc["alias"]
        else:
            alias = f"{db_desc['dbms']}_{id}"

        if db_desc["driver"]:
            drivers = [db_desc["driver"]]
        else:
            drivers = ASYNC_DRIVERS.get(db_desc["dbms"], [])

        for driver in drivers:
            url = URL.create(
                drivername=f"{db_desc['dbms']}+{driver}",
                host=db_desc["host"],
                port=db_desc["port"],
                database=db_desc["database"]
            )
            try:
                create_async_engine(url)
                cls.databases.append({
                    "alias": alias,
                    "id": id,
                    "url": url,
                    "is_async": True
                })
                return
            except (InvalidRequestError, NoSuchModuleError):
                # InvalidRequestError is raised if the driver is not async.
                # NoSuchModuleError is raised if the driver is not installed.
                continue

        driver = f"+{db_desc['driver']}" if db_desc["driver"] else ""
        url = URL.create(
            drivername=f"{db_desc['dbms']}{driver}",
            host=db_desc["host"],
            port=db_desc["port"],
            database=db_desc["database"]
        )
        create_engine(url)
        cls.databases.append({
            "alias": alias,
            "id": id,
            "url": url,
            "is_async": False
        })
        cls.warnings.append("No async driver found, the query will be executed synchronously")
        print(cls.warnings[-1])

    @classmethod
    def get_databases(cls):
        summary_databases: [DatabaseSummary] = []
        for database in cls.databases:
            url: URL = database["url"]
            summary: DatabaseSummary = {
                "alias": database["alias"],
                "database": url.database,
                "driver": url.drivername,
                "id": database["id"],
                "is_async": database["is_async"]
            }
            if url.host:
                summary["host"] = url.host
            if url.port:
                summary["port"] = url.port
            summary_databases.append(summary)
        return summary_databases

    @staticmethod
    def to_list(cursor: CursorResult[Any]) -> List[Dict]:
        return [row._asdict() for row in cursor.fetchall()]
