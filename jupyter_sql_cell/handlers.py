import json

from jupyter_server.base.handlers import APIHandler
import tornado

from .sqlconnector import SQLConnector


def reply_error(api: APIHandler, msg: StopIteration):
    api.set_status(500)
    api.log.error(msg)
    reply = {"message": msg}
    api.finish(json.dumps(reply))


class DatabasesHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        try:
            databases = SQLConnector.get_databases()
            self.finish(json.dumps(databases))
        except Exception as e:
            self.log.error(f"Databases error\n{e}")
            self.write_error(500, exec_info=e)


class ExecuteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.gen.coroutine
    @tornado.web.authenticated
    def post(self):
        body = json.loads(self.request.body)
        id = body.get("id", None)
        query = body.get("query", None)

        if id is None:
            reply_error(self, "The database id has not been provided")
            return
        if not query:
            reply_error(self, "No query has been provided")
            return
        try:
            connector = SQLConnector(int(id))
            if connector.errors:
                reply_error(self, connector.errors[0])
                return
        except Exception as e:
            self.log.error(f"Connector error\n{e}")
            self.write_error(500, exec_info=e)
            return

        try:
            result = yield connector.execute(query)
            self.finish(json.dumps({
                "alias": connector.database["alias"],
                "data": result,
                "id": id,
                "query": query,
            }))
        except Exception as e:
            self.log.error(f"Query error\n{e}")
            self.write_error(500, exec_info=e)


class DatabaseSchemaHandler(APIHandler):
    @tornado.gen.coroutine
    @tornado.web.authenticated
    def get(self):
        id = self.get_argument("id", "")
        target = self.get_argument("target", "tables")
        table = self.get_argument("table", "")

        if not id:
            reply_error(self, "The database id has not been provided")
            return
        if target not in ["tables", "columns"]:
            reply_error(self, "Target must be \"tables\" or \"columns\"")
            return
        if target == "columns" and not table:
            reply_error(self, "The table has not been provided")
            return

        try:
            connector = SQLConnector(int(id))
            if connector.errors:
                reply_error(self, connector.errors[0])
                return
        except Exception as e:
            self.log.error(f"Connector error\n{e}")
            self.write_error(500, exec_info=e)
            return

        try:
            data = yield connector.get_schema(target, table)
            self.finish(json.dumps({
                "data": data,
                "id": id,
                "table": table,
                "target": target
            }))
        except Exception as e:
            self.log.error(f"Query error\n{e}")
            self.write_error(500, exec_info=e)


class ExampleHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.web.authenticated
    def get(self):
        self.finish(json.dumps({
            "data": "This is /jupyter-sql-cell/get-example endpoint!"
        }))
