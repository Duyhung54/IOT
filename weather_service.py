"""
Weather Service Module
Integrates with OpenWeatherMap API to fetch current weather and forecast data
"""
import requests
from typing import Optional, Dict, Any
from datetime import datetime
import os

# Default location: Hanoi, Vietnam
DEFAULT_LAT = 21.0285
DEFAULT_LON = 105.8542

OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5"


def get_current_weather(api_key: str, lat: float = DEFAULT_LAT, lon: float = DEFAULT_LON) -> Optional[Dict[str, Any]]:
    """
    Fetch current weather data from OpenWeatherMap API
    
    Args:
        api_key: OpenWeatherMap API key
        lat: Latitude (default: Hanoi)
        lon: Longitude (default: Hanoi)
    
    Returns:
        Formatted weather data or None if request fails
    """
    url = f"{OPENWEATHER_BASE_URL}/weather"
    params = {
        "lat": lat,
        "lon": lon,
        "appid": api_key,
        "units": "metric",  # Celsius
        "lang": "vi"  # Vietnamese
    }
    
    try:
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        return format_current_weather(data)
    except Exception as e:
        print(f"⚠️ Weather API Error: {e}")
        return None


def get_weather_forecast(api_key: str, lat: float = DEFAULT_LAT, lon: float = DEFAULT_LON) -> Optional[Dict[str, Any]]:
    """
    Fetch 5-day weather forecast from OpenWeatherMap API
    
    Args:
        api_key: OpenWeatherMap API key
        lat: Latitude (default: Hanoi)
        lon: Longitude (default: Hanoi)
    
    Returns:
        Formatted forecast data or None if request fails
    """
    url = f"{OPENWEATHER_BASE_URL}/forecast"
    params = {
        "lat": lat,
        "lon": lon,
        "appid": api_key,
        "units": "metric",
        "lang": "vi"
    }
    
    try:
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        return format_forecast(data)
    except Exception as e:
        print(f"⚠️ Forecast API Error: {e}")
        return None


def format_current_weather(raw_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format raw OpenWeatherMap current weather data
    
    Args:
        raw_data: Raw API response
    
    Returns:
        Formatted weather data
    """
    return {
        "temperature": round(raw_data["main"]["temp"], 1),
        "feels_like": round(raw_data["main"]["feels_like"], 1),
        "humidity": raw_data["main"]["humidity"],
        "description": raw_data["weather"][0]["description"],
        "icon": raw_data["weather"][0]["icon"],
        "location": raw_data["name"],
        "timestamp": raw_data["dt"]
    }


def format_forecast(raw_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format raw OpenWeatherMap forecast data
    Extract daily forecasts (one per day at noon)
    
    Args:
        raw_data: Raw API response
    
    Returns:
        Formatted forecast data with 3-5 days
    """
    daily_forecasts = []
    seen_dates = set()
    
    for item in raw_data["list"]:
        # Get date from timestamp
        dt = datetime.fromtimestamp(item["dt"])
        date_str = dt.strftime("%Y-%m-%d")
        
        # Take one forecast per day (prefer noon time: 12:00)
        if date_str not in seen_dates:
            if "12:00:00" in item["dt_txt"] or len(seen_dates) < 5:
                seen_dates.add(date_str)
                daily_forecasts.append({
                    "date": date_str,
                    "day_name": dt.strftime("%a"),  # Mon, Tue, Wed
                    "temperature": round(item["main"]["temp"], 1),
                    "description": item["weather"][0]["description"],
                    "icon": item["weather"][0]["icon"]
                })
        
        if len(daily_forecasts) >= 5:
            break
    
    return {
        "location": raw_data["city"]["name"],
        "forecasts": daily_forecasts[:5]  # Return max 5 days
    }


def get_mock_weather() -> Dict[str, Any]:
    """
    Return mock weather data for testing without API key
    """
    return {
        "temperature": 28.2,
        "feels_like": 30.5,
        "humidity": 65,
        "description": "Clear, night",
        "icon": "01n",
        "location": "Home",
        "timestamp": int(datetime.now().timestamp())
    }


def get_mock_forecast() -> Dict[str, Any]:
    """
    Return mock forecast data for testing without API key
    """
    return {
        "location": "Home",
        "forecasts": [
            {"date": "2026-02-04", "day_name": "Tue", "temperature": 21, "description": "Clear", "icon": "01d"},
            {"date": "2026-02-05", "day_name": "Wed", "temperature": 25, "description": "Cloudy", "icon": "04d"},
            {"date": "2026-02-06", "day_name": "Thu", "temperature": 22, "description": "Clear", "icon": "01d"}
        ]
    }
