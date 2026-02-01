import requests
import json
from datetime import datetime



# Configuration from mock_rtdb_viewer.html
FIREBASE_DB_URL = "https://mse-iot-smart-home-default-rtdb.asia-southeast1.firebasedatabase.app"
SENSOR_PATH = "cooling_system/sensor_data"
CMDS_PATH = "cooling_system/actuator_cmds"

def push_telemetry(data: dict):
    """
    Push sensor data to Firebase
    To be used with FastAPI BackgroundTasks
    """
    url = f"{FIREBASE_DB_URL}/{SENSOR_PATH}.json"
    
    # Ensure timestamp is present
    if "ts" not in data:
        data["ts"] = int(datetime.utcnow().timestamp())
        
    try:
        # Use PUT to overwrite the node (single source of truth for current state)
        requests.put(url, json=data, timeout=5)
    except Exception as e:
        print(f"⚠️ Firebase Sync Error: {e}")

def push_command(command_type: str, details: dict):
    """
    Push control command to Firebase
    To be used with FastAPI BackgroundTasks
    """
    url = f"{FIREBASE_DB_URL}/{CMDS_PATH}.json"
    
    payload = {
        "type": command_type,
        "ts": int(datetime.utcnow().timestamp()),
        **details
    }
    
    try:
        requests.post(url, json=payload, timeout=5)
    except Exception as e:
        print(f"⚠️ Firebase Sync Error: {e}")
