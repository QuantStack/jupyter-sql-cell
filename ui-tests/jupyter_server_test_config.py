"""Server configuration for integration tests.

!! Never use this configuration in production because it
opens the server to the world and provide access to JupyterLab
JavaScript objects through the global window variable.
"""
import os
from pathlib import Path
from jupyterlab.galata import configure_jupyter_server

configure_jupyter_server(c)

c.FileContentsManager.delete_to_trash = False

# Uncomment to set server log level to debug level
# c.ServerApp.log_level = "DEBUG"

# Link two test databases in the application
test_db_path = Path(__file__).parent.parent / "jupyter_sql_cell" / "tests" / "data"
databases = []
for file in os.listdir(test_db_path):
  file_path = test_db_path / file
  databases.append({
    "database":str(test_db_path / file),
    "dbms":"sqlite",
    "driver":"pysqlite",
    "alias":file_path.stem
  })

c.JupyterSqlCell.databases = databases
