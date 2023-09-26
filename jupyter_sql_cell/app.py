import pathlib

from jupyter_server.extension.application import ExtensionApp
from jupyter_server.utils import url_path_join
from traitlets import Unicode

from .handlers import ExampleHandler, ExecuteHandler
from .sqlconnector import SQLConnector


class JupyterSqlCell(ExtensionApp):

    name = "JupyterSqlCell"
    default_url = "/jupyter-sql-cell"

    db_url = Unicode(
        "",
        help="The database URL"
    ).tag(config=True)


    def __init__(self) -> None:
        super().__init__()

    def initialize(self):
        path = pathlib.Path(__file__)
        if not self.db_url:
            path = pathlib.Path(__file__).parent / "tests" / "data" / "world.sqlite"
            self.db_url = f"sqlite+aiosqlite:///{path}"
        SQLConnector.db_url = self.db_url
        return super().initialize()

    def initialize_handlers(self):
        super().initialize_handlers()
        example_pattern = url_path_join("/jupyter-sql-cell", "get-example")
        execute_pattern = url_path_join("/jupyter-sql-cell", "execute")
        self.handlers.extend([
            (example_pattern, ExampleHandler),
            (execute_pattern, ExecuteHandler)
        ])
