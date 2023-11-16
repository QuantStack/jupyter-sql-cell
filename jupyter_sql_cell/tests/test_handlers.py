import pytest
import json
from tornado.httpclient import HTTPClientError


"""
Should load and query the default database when none has been provided in config.
"""
async def test_execute_default(jp_fetch):
    query = "SELECT Abbreviation FROM world WHERE Country='France'"
    response = await jp_fetch(
        "jupyter-sql-cell",
        "execute",
        body=json.dumps({
            "query": query,
            "id": "0"
        }),
        method="POST"
    )

    assert response.code == 200
    payload = json.loads(response.body)
    assert list(payload.keys()) == ["alias", "data", "id", "query"]
    assert payload["data"] == [{"Abbreviation": "FR"}]
    assert payload["query"] == query
    assert payload["id"] == "0"


"""
Should raise if the database ID has not been provided.
"""
async def test_execute_no_id(jp_fetch):
    with pytest.raises(HTTPClientError):
        response = await jp_fetch(
            "jupyter-sql-cell",
            "execute",
            body=json.dumps({
                "query": "SELECT Abbreviation FROM world WHERE Country='France'"
            }),
            method="POST"
        )


"""
Should raise if the query has not been provided.
"""
async def test_execute_no_query(jp_fetch):
    with pytest.raises(HTTPClientError):
        response = await jp_fetch(
            "jupyter-sql-cell",
            "execute",
            body=json.dumps({
                "id": "0"
            }),
            method="POST"
        )


"""
Should return the tables list.
"""
async def test_get_tables(jp_fetch):
    response = await jp_fetch(
        "jupyter-sql-cell",
        "schema",
        params=[("id", "0"), ("target", "tables")]
    )
    assert response.code == 200
    payload = json.loads(response.body)
    assert payload["data"] == ["world"]


"""
Should return the tables list if no target is defined.
"""
async def test_get_tables_no_target(jp_fetch):
    response = await jp_fetch(
        "jupyter-sql-cell",
        "schema",
        params=[("id", "0")]
    )
    assert response.code == 200
    payload = json.loads(response.body)
    assert payload["data"] == ["world"]


"""
Should return the column names.
"""
async def test_get_columns(jp_fetch):
    response = await jp_fetch(
        "jupyter-sql-cell",
        "schema",
        params=[("id", "0"), ("target", "columns"), ("table", "world")]
    )
    assert response.code == 200
    payload = json.loads(response.body)
    assert "Abbreviation" in payload["data"]


"""
Should raise if the table is not provided.
"""
async def test_get_columns_no_table(jp_fetch):
    with pytest.raises(HTTPClientError):
        response = await jp_fetch(
            "jupyter-sql-cell",
            "schema",
            params=[("id", "0"), ("target", "columns")]
        )


"""
Should raise if the target is wrong.
"""
async def test_get_schema_wrong_target(jp_fetch):
    with pytest.raises(HTTPClientError):
        response = await jp_fetch(
            "jupyter-sql-cell",
            "schema",
            params=[("id", "0"), ("target", "fake")]
        )
