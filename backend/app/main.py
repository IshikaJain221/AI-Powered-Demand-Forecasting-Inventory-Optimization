from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import Base, engine
from app.routers import forecast, supply_chain, copilot
from app.services.copilot import MCPToolBridge

Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    bridge = MCPToolBridge()
    await bridge.start()
    app.state.mcp_bridge = bridge
    yield
    await bridge.stop()


app = FastAPI(title="Demand Forecasting & Inventory Optimization API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forecast.router)
app.include_router(supply_chain.router)
app.include_router(copilot.router)


@app.get("/")
def root():
    return {"status": "ok"}
