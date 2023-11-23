from sqlalchemy.exc import InvalidRequestError, NoSuchModuleError
from sqlalchemy.ext.asyncio import AsyncConnection, create_async_engine
from sqlalchemy import CursorResult, Inspector, URL, create_engine, inspect, text
from typing import Any, Dict, List, Optional, TypedDict


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
    alias: str
    id: int
    is_async: bool


class SQLConnector:

    databases: [Database] = []
    warnings = []

    def __init__(self, database_id: int):
        self.engine = None
        self.errors = []
        self.is_async = False
        self.database: Database = next(filter(lambda db: db["id"] == database_id, self.databases), None)
        if not self.database:
            self.errors.append(f"There is no registered database with id {database_id}")
        else:
            self.is_async = self.database["is_async"]
            if self.is_async:
                self.engine = create_async_engine(self.database["url"])
            else:
                self.engine = create_engine(self.database["url"])

    async def get_schema(self, target: str, table: str = "") -> [str]:
        if self.is_async:
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
        if self.is_async:
            cursor: CursorResult[Any] = await self.execute_request_async(query)
        else:
            cursor: CursorResult[Any] = self.execute_request(query)

        return self.to_list(cursor)

    def execute_request(self, query: str) -> CursorResult[Any]:
        with self.engine.connect() as connection:
            return connection.execute(text(query))

    async def execute_request_async(self, query: str) -> CursorResult[Any]:
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

        # If the driver is filled, test if it is async.
        if db_desc["driver"]:
            url = URL.create(
                drivername=f"{db_desc['dbms']}+{db_desc['driver']}",
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
            except NoSuchModuleError:
                # NoSuchModuleError is raised if the driver is not installed.
                raise Exception(
                    f"The database's driver \"{db_desc['driver']}\" is not installed."
                )
            except InvalidRequestError:
                # InvalidRequestError is raised if the driver is not async.
                # Let's try this driver as synchronous.
                pass

        # If the driver is not async or not filled, use the default sync engine.
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
        return sorted(summary_databases, key=lambda d: d['alias'].upper())

    @staticmethod
    def to_list(cursor: CursorResult[Any]) -> List[Dict]:
        return [row._asdict() for row in cursor.fetchall()]
