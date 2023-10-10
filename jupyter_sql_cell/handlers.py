import json

from jupyter_server.base.handlers import APIHandler
import tornado

from .sqlconnector import SQLConnector


def reply_error(api: APIHandler, msg: StopIteration):
    api.set_status(500)
    api.log.error(msg)
    reply = {"message": msg}
    api.finish(json.dumps(reply))


class ExecuteHandler(APIHandler):
    # The following decorator should be present on all verb methods (head, get, post,
    # patch, put, delete, options) to ensure only authorized user can request the
    # Jupyter server
    @tornado.gen.coroutine
    @tornado.web.authenticated
    def post(self):
        body = json.loads(self.request.body)
        id = body.get("id", "0")
        query = body.get("query", None)

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
                "id": id,
                "url": connector.database["url"],
                "query": query,
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
