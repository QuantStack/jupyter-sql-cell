import pathlib

from jupyter_server.extension.application import ExtensionApp
from jupyter_server.utils import url_path_join
from traitlets import Dict, Integer, List, Unicode

from .handlers import DatabasesHandler, DatabaseSchemaHandler, ExecuteHandler
from .sqlconnector import SQLConnector


class JupyterSqlCell(ExtensionApp):

    name = "JupyterSqlCell"
    default_url = "/jupyter-sql-cell"

    database = Dict(per_key_traits={
        "alias": Unicode(default_value=None, allow_none=True),
        "database": Unicode(),
        "dbms": Unicode(),
        "driver": Unicode(default_value=None, allow_none=True),
        "host": Unicode(default_value=None, allow_none=True),
        "port": Integer(default_value=None, allow_none=True)
        },
        default_value={},
        help="The databases description"
    ).tag(config=True)

    databases = List(
        Dict(per_key_traits={
            "alias": Unicode(default_value=None, allow_none=True),
            "database": Unicode(),
            "dbms": Unicode(),
            "driver": Unicode(default_value=None, allow_none=True),
            "host": Unicode(default_value=None, allow_none=True),
            "port": Integer(default_value=None, allow_none=True)
        }),
        default_value=[],
        help="The databases description",
    ).tag(config=True)

    def __init__(self) -> None:
        super().__init__()

    def initialize(self):
        path = pathlib.Path(__file__)
        if self.database:
            self.databases.append(self.database)

        if not self.databases:
            path = pathlib.Path(__file__).parent / "tests" / "data" / "world.sqlite"
            self.databases = [{
                "alias": "default",
                "database": str(path),
                "dbms": "sqlite",
                "driver": None,
                "host": None,
                "port": None
            }]
        for database in self.databases:
            for option in ["alias", "driver", "host", "port"]:
                if not option in database.keys():
                    database[option] = None
            SQLConnector.add_database(database)

        return super().initialize()

    def initialize_handlers(self):
        super().initialize_handlers()
        databases_pattern = url_path_join(self.default_url, "databases")
        execute_pattern = url_path_join(self.default_url, "execute")
        schema_pattern = url_path_join(self.default_url, "schema")
        self.handlers.extend([
            (databases_pattern, DatabasesHandler),
            (execute_pattern, ExecuteHandler),
            (schema_pattern, DatabaseSchemaHandler)
        ])
