from fastapi import FastAPI, Depends, Request, BackgroundTasks
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Dict
from database import create_db_and_tables, get_session, Telemetry, ACSettings, ActuatorState
from dotenv import load_dotenv
import os
from datetime import datetime

# Load environment variables
load_dotenv()

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

class ActuatorStateInput(BaseModel):
    mode_request: str  # "auto", "manual", or "ai"
    ac: int  # 0 or 1
    fan: int  # 0 or 1
    temp_threshold: float
    end_user_ai_instruction: str = ""
    source: str = "web_client"


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
import weather_service  # Import weather service

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
    # Send flattened data to match frontend expectation and SQL model
    firebase_data = {
        "device_id": data.device_id,
        "unit": data.unit,
        "ts": data.ts,
        "temp_inside": data.temperatures.inside.value,
        "temp_outside": data.temperatures.outside.value
    }
    background_tasks.add_task(firebase_client.push_telemetry, firebase_data)
    
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

@app.get("/api/weather/current")
def get_current_weather():
    """Get current weather data"""
    api_key = os.getenv("OPENWEATHER_API_KEY")
    
    # If no API key, return mock data
    if not api_key or api_key == "your_api_key_here":
        return weather_service.get_mock_weather()
    
    # Get location from env or use defaults
    lat = float(os.getenv("WEATHER_LOCATION_LAT", weather_service.DEFAULT_LAT))
    lon = float(os.getenv("WEATHER_LOCATION_LON", weather_service.DEFAULT_LON))
    
    weather_data = weather_service.get_current_weather(api_key, lat, lon)
    
    if weather_data:
        return weather_data
    else:
        # Fallback to mock data if API fails
        return weather_service.get_mock_weather()

@app.get("/api/weather/forecast")
def get_weather_forecast():
    """Get weather forecast (3-5 days)"""
    api_key = os.getenv("OPENWEATHER_API_KEY")
    
    # If no API key, return mock data
    if not api_key or api_key == "your_api_key_here":
        return weather_service.get_mock_forecast()
    
    # Get location from env or use defaults
    lat = float(os.getenv("WEATHER_LOCATION_LAT", weather_service.DEFAULT_LAT))
    lon = float(os.getenv("WEATHER_LOCATION_LON", weather_service.DEFAULT_LON))
    
    forecast_data = weather_service.get_weather_forecast(api_key, lat, lon)
    
    if forecast_data:
        return forecast_data
    else:
        # Fallback to mock data if API fails
        return weather_service.get_mock_forecast()

@app.get("/api/datetime")
def get_current_datetime():
    """Get current server date and time"""
    now = datetime.now()
    return {
        "timestamp": int(now.timestamp()),
        "date": now.strftime("%Y-%m-%d"),
        "time": now.strftime("%H:%M:%S"),
        "day_name": now.strftime("%A"),
        "formatted": now.strftime("%d/%m/%Y %H:%M:%S")
    }

@app.get("/api/actuator/state")
def get_actuator_state(session: Session = Depends(get_session)):
    """Get current actuator state (AC/Fan controls)"""
    statement = select(ActuatorState).limit(1)
    state = session.exec(statement).first()
    
    if not state:
        # Return default state if none exists
        return {
            "mode_request": "manual",
            "ac": 0,
            "fan": 0,
            "temp_threshold": 25.0,
            "end_user_ai_instruction": "",
            "source": "web_client"
        }
    
    return {
        "mode_request": state.mode_request,
        "ac": state.ac,
        "fan": state.fan,
        "temp_threshold": state.temp_threshold,
        "end_user_ai_instruction": state.end_user_ai_instruction,
        "source": state.source
    }

@app.post("/api/actuator/state")
def set_actuator_state(data: ActuatorStateInput, background_tasks: BackgroundTasks, session: Session = Depends(get_session)):
    """Update actuator state (AC/Fan controls)"""
    # Get or create actuator state
    statement = select(ActuatorState).limit(1)
    state = session.exec(statement).first()
    
    if not state:
        state = ActuatorState()
        session.add(state)
    
    # Update all fields
    state.mode_request = data.mode_request
    state.ac = data.ac
    state.fan = data.fan
    state.temp_threshold = data.temp_threshold
    state.end_user_ai_instruction = data.end_user_ai_instruction
    state.source = data.source
    state.last_updated = datetime.now()
    
    session.commit()
    session.refresh(state)
    
    # Optionally sync to Firebase
    background_tasks.add_task(firebase_client.push_command, "actuator_update", data.dict())
    
    return {
        "status": "ok",
        "api_state": {
            "mode_request": state.mode_request,
            "ac": state.ac,
            "fan": state.fan,
            "temp_threshold": state.temp_threshold,
            "end_user_ai_instruction": state.end_user_ai_instruction,
            "source": state.source
        }
    }

