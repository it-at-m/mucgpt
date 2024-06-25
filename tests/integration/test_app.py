import pytest
import quart.testing.app

import app


@pytest.mark.asyncio
@pytest.mark.integration
async def test_missing_env_vars():
    quart_app = app.create_app()

    with pytest.raises(quart.testing.app.LifespanError) as exc_info:
        async with quart_app.test_app() as test_app:
            test_app.test_client()
        assert str(exc_info.value) == "Lifespan failure in startup. ''AZURE_OPENAI_EMB_DEPLOYMENT''"

@pytest.mark.asyncio
@pytest.mark.integration
async def test_index(client):
    response = await client.get('/')
    assert response.status_code == 200


@pytest.mark.asyncio
@pytest.mark.integration
async def test_unknown_endpoint(client):
    response = await client.post("/unknownendpoint")
    assert response.status_code == 404

