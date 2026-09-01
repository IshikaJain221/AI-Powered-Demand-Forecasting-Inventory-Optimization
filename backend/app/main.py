from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import Base, engine
from app.routers import forecast

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Demand Forecasting & Inventory Optimization API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forecast.router)


@app.get("/")
def root():
    return {"status": "ok"}
