try:
    from ._version import __version__
except ImportError:
    # Fallback when using the package in dev mode without installing
    # in editable mode with pip. It is highly recommended to install
    # the package from a stable release or in editable mode: https://pip.pypa.io/en/stable/topics/local-project-installs/#editable-installs
    import warnings
    warnings.warn("Importing 'jupyter_sql_cell' outside a proper installation.")
    __version__ = "dev"

from jupyter_sql_cell.app import JupyterSqlCell


def _jupyter_labextension_paths():
    return [{
        "src": "labextension",
        "dest": "@jupyter/sql-cell"
    }]


def _jupyter_server_extension_points():
    return [{
        "module": "jupyter_sql_cell",
        "app": JupyterSqlCell
    }]


_load_jupyter_server_extension = JupyterSqlCell._load_jupyter_server_extension
