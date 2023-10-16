import json


async def test_get_example(jp_fetch):
    # When
    response = await jp_fetch("jupyter-sql-cell", "get-example")

    # Then
    assert response.code == 200
    payload = json.loads(response.body)
    assert payload == {
        "data": "This is /jupyter-sql-cell/get-example endpoint!"
    }


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
Should load and query the default database when none has been provided.
Missing ID in request should fall back on first database.
"""
async def test_execute_no_id(jp_fetch):
    response = await jp_fetch(
        "jupyter-sql-cell",
        "execute",
        body=json.dumps({
            "query": "SELECT Abbreviation FROM world WHERE Country='France'"
        }),
        method="POST"
    )

    assert response.code == 200
    payload = json.loads(response.body)
    assert payload["data"] == [{"Abbreviation": "FR"}]
