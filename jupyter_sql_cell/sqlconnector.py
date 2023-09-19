from jupyter_server import log
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import CursorResult, text
from typing import Any, Dict, List


class SQLConnector:

    db_url: str = ""

    engine = None

    def __init__(self) -> None:
        if not self.db_url:
            log.warn("The database URL is not set")
        self.engine = create_async_engine(self.db_url)

    async def execute(self, query: str) -> str:
        if not self.engine:
            return "SQL engine has not been created"
        cursor: CursorResult[Any] = await self.execute_request(query)

        return self.to_list(cursor)

    async def execute_request(self, query: str) -> CursorResult[Any]:
        async with self.engine.connect() as connection:
            cursor: CursorResult[Any] = await connection.execute(text(query))
            return cursor

    @staticmethod
    def to_list(cursor: CursorResult[Any]) -> List[Dict]:
        return [row._asdict() for row in cursor.fetchall()]
