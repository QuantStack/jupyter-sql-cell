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

async def test_execute(jp_fetch):
    response = await jp_fetch(
        "jupyter-sql-cell",
        "execute",
        body=json.dumps({"query": "SELECT Abbreviation FROM world WHERE Country='France'"}),
        method="POST"
    )

    assert response.code == 200
    payload = json.loads(response.body)
    assert payload == {
        "data": [{"Abbreviation": "FR"}]
    }
