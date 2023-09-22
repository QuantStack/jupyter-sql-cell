import json

from jupyter_server.base.handlers import APIHandler
import tornado

from .sqlconnector import SQLConnector


class ExecuteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.gen.coroutine
    @tornado.web.authenticated
    def post(self):
        query = json.loads(self.request.body).get("query", None)

        try:
            connector = SQLConnector()
        except Exception as e:
            self.log.error(f"Connector error\n{e}")
            self.write_error(500, exec_info=e)

        try:
            result = yield connector.execute(query)
            self.finish(json.dumps({
                "data": result
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
