from fastapi import FastAPI, Depends, Request, BackgroundTasks
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Dict
from database import create_db_and_tables, get_session, Telemetry, ACSettings

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

class ManualControlInput(BaseModel):
    is_on: bool
    target_temp: float
    mode: str  # "cool", "heat", "fan"

class AutomationInput(BaseModel):
    enabled: bool
    threshold_temp: float

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

import firebase_client  # Import the new client

@app.post("/api/telemetry")
def save_telemetry(data: TelemetryInput, background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
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
    
    # [OPTIMIZED] Sync to Firebase in background
    background_tasks.add_task(firebase_client.push_telemetry, data.dict())
    
    return {"status": "ok", "id": telemetry.id}

@app.get("/api/data")
def get_history(session: Session = Depends(get_session)):
    # Get last 50 readings
    statement = select(Telemetry).order_by(Telemetry.ts.desc()).limit(50)
    results = session.exec(statement).all()
    # Reverse to show oldest to newest in chart
    return results

@app.post("/api/ac/manual")
def set_manual_control(data: ManualControlInput, background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
    """Set manual AC control settings"""
    from datetime import datetime
    
    # Get or create AC settings
    statement = select(ACSettings).limit(1)
    ac_settings = session.exec(statement).first()
    
    if not ac_settings:
        ac_settings = ACSettings()
        session.add(ac_settings)
    
    # Update settings
    ac_settings.mode = "manual"
    ac_settings.is_on = data.is_on
    ac_settings.target_temp = data.target_temp
    ac_settings.last_updated = datetime.utcnow()
    
    session.commit()
    session.refresh(ac_settings)
    
    # [OPTIMIZED] Sync command to Firebase in background
    background_tasks.add_task(firebase_client.push_command, "manual_update", data.dict())
    
    return {
        "status": "ok",
        "settings": {
            "mode": ac_settings.mode,
            "is_on": ac_settings.is_on,
            "target_temp": ac_settings.target_temp
        }
    }

@app.post("/api/ac/automation")
def set_automation(data: AutomationInput, background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
    """Configure automation settings"""
    from datetime import datetime
    
    # Get or create AC settings
    statement = select(ACSettings).limit(1)
    ac_settings = session.exec(statement).first()
    
    if not ac_settings:
        ac_settings = ACSettings()
        session.add(ac_settings)
    
    # Update automation settings
    ac_settings.automation_enabled = data.enabled
    ac_settings.threshold_temp = data.threshold_temp
    if data.enabled:
        ac_settings.mode = "auto"
    ac_settings.last_updated = datetime.utcnow()
    
    session.commit()
    session.refresh(ac_settings)
    
    # [OPTIMIZED] Sync command to Firebase in background
    background_tasks.add_task(firebase_client.push_command, "automation_update", data.dict())
    
    return {
        "status": "ok",
        "settings": {
            "automation_enabled": ac_settings.automation_enabled,
            "threshold_temp": ac_settings.threshold_temp,
            "mode": ac_settings.mode
        }
    }

@app.get("/api/ac/settings")
def get_ac_settings(session: Session = Depends(get_session)):
    """Get current AC settings"""
    statement = select(ACSettings).limit(1)
    ac_settings = session.exec(statement).first()
    
    if not ac_settings:
        # Return default settings if none exist
        return {
            "mode": "manual",
            "is_on": False,
            "target_temp": 22.0,
            "threshold_temp": 25.0,
            "automation_enabled": False
        }
    
    return {
        "mode": ac_settings.mode,
        "is_on": ac_settings.is_on,
        "target_temp": ac_settings.target_temp,
        "threshold_temp": ac_settings.threshold_temp,
        "automation_enabled": ac_settings.automation_enabled
    }
