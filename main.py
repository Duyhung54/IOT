from fastapi import FastAPI, Depends, Request
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Dict
from database import create_db_and_tables, get_session, Telemetry

# Pydantic models for incoming JSON validation
class SensorData(BaseModel):
    sensor_id: str
    value: float

class TemperatureData(BaseModel):
    inside: SensorData
    outside: SensorData

class TelemetryInput(BaseModel):
    device_id: str
    interval_s: int
    unit: str
    ts: int
    temperatures: TemperatureData

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield

app = FastAPI(lifespan=lifespan)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# CORS (Optional, good for local dev if frontend was separate)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/api/telemetry")
def save_telemetry(data: TelemetryInput, session: Session = Depends(get_session)):
    telemetry = Telemetry(
        device_id=data.device_id,
        unit=data.unit,
        ts=data.ts,
        temp_inside=data.temperatures.inside.value,
        temp_outside=data.temperatures.outside.value
    )
    session.add(telemetry)
    session.commit()
    session.refresh(telemetry)
    return {"status": "ok", "id": telemetry.id}

@app.get("/api/data")
def get_history(session: Session = Depends(get_session)):
    # Get last 50 readings
    statement = select(Telemetry).order_by(Telemetry.ts.desc()).limit(50)
    results = session.exec(statement).all()
    # Reverse to show oldest to newest in chart
    return results
