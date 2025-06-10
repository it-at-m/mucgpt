from fastapi import FastAPI
from fastapi.responses import RedirectResponse

# serves static files and the api
backend = FastAPI(title="MUCGPT-Assistant-Service")
api_app = FastAPI(title="MUCGPT-Assistant-Service-API")
backend.mount("/api/", api_app)


@api_app.post("/bot/create")
async def createBot():
    # not yet implemented
    return RedirectResponse(url="/docs", status_code=303)


@api_app.post("/bot/{id}/delete")
async def deleteBot():
    # not yet implemented
    return RedirectResponse(url="/docs", status_code=303)


@api_app.post("/bot/{id}/update")
async def updateBot():
    # not yet implemented
    return RedirectResponse(url="/docs", status_code=303)


@api_app.get("/bot")
async def getAllBots():
    # not yet implemented
    return RedirectResponse(url="/docs", status_code=303)


@api_app.get("/bot/{id}/{version}")
async def getBot(
    id: str,
    version: str,
):
    # not yet implemented
    return RedirectResponse(url="/docs", status_code=303)


@api_app.get("/bot/{id}")
async def getBotAllVersions(
    id: str,
):
    # not yet implemented
    return RedirectResponse(url="/docs", status_code=303)


@api_app.get("/health")
def health_check() -> str:
    return "OK"
