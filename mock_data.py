"""
Script to generate mock telemetry data for the IoT Dashboard
"""
import requests
import time
import random
from datetime import datetime

API_URL = "http://localhost:8000/api/telemetry"

def generate_temperature(base_temp, variation=3):
    """Generate realistic temperature with some variation"""
    return round(base_temp + random.uniform(-variation, variation), 1)

def send_telemetry_data():
    """Send mock telemetry data to the API"""
    
    # Base temperatures
    inside_base = 24.0  # Room temperature
    outside_base = 28.0  # Outside temperature
    
    # Generate timestamps
    current_timestamp = int(time.time())
    
    # Create telemetry data
    data = {
        "device_id": "ESP32_DEMO_001",
        "interval_s": 5,
        "unit": "C",
        "ts": current_timestamp,
        "temperatures": {
            "inside": {
                "sensor_id": "DHT22_INSIDE",
                "value": generate_temperature(inside_base, 2)
            },
            "outside": {
                "sensor_id": "DHT22_OUTSIDE",
                "value": generate_temperature(outside_base, 3)
            }
        }
    }
    
    try:
        response = requests.post(API_URL, json=data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Data sent successfully - ID: {result.get('id')}")
            print(f"   Inside: {data['temperatures']['inside']['value']}°C")
            print(f"   Outside: {data['temperatures']['outside']['value']}°C")
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Connection error: {e}")

def populate_historical_data(count=30):
    """Populate database with historical data points"""
    print(f"📊 Generating {count} historical data points...\n")
    
    current_timestamp = int(time.time())
    
    for i in range(count):
        # Go back in time, spaced by 5 seconds
        timestamp = current_timestamp - ((count - i) * 5)
        
        # Simulate temperature variations throughout the day
        hour = datetime.fromtimestamp(timestamp).hour
        
        # Inside temperature varies slightly
        inside_temp = 22 + random.uniform(-1, 3) + (hour % 12) * 0.3
        
        # Outside temperature varies more
        outside_temp = 25 + random.uniform(-2, 4) + (hour % 12) * 0.5
        
        data = {
            "device_id": "ESP32_DEMO_001",
            "interval_s": 5,
            "unit": "C",
            "ts": timestamp,
            "temperatures": {
                "inside": {
                    "sensor_id": "DHT22_INSIDE",
                    "value": round(inside_temp, 1)
                },
                "outside": {
                    "sensor_id": "DHT22_OUTSIDE",
                    "value": round(outside_temp, 1)
                }
            }
        }
        
        try:
            response = requests.post(API_URL, json=data)
            if response.status_code == 200:
                print(f"✅ Point {i+1}/{count}: Inside={inside_temp:.1f}°C, Outside={outside_temp:.1f}°C")
            else:
                print(f"❌ Error at point {i+1}: {response.status_code}")
        except Exception as e:
            print(f"❌ Error at point {i+1}: {e}")
            break
        
        # Small delay to avoid overwhelming the server
        time.sleep(0.1)
    
    print(f"\n✅ Completed! {count} data points added.")

def continuous_monitoring(interval=5):
    """Continuously send telemetry data"""
    print(f"🔄 Starting continuous monitoring (every {interval} seconds)")
    print("Press Ctrl+C to stop\n")
    
    try:
        while True:
            send_telemetry_data()
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\n\n⏹️  Monitoring stopped.")

if __name__ == "__main__":
    print("=" * 60)
    print("    IoT Dashboard - Mock Data Generator")
    print("=" * 60)
    print()
    print("Choose an option:")
    print("1. Add 30 historical data points (for charts)")
    print("2. Add 50 historical data points")
    print("3. Send single data point")
    print("4. Continuous monitoring (every 5 seconds)")
    print()
    
    choice = input("Enter choice (1-4): ").strip()
    
    print()
    
    if choice == "1":
        populate_historical_data(30)
    elif choice == "2":
        populate_historical_data(50)
    elif choice == "3":
        send_telemetry_data()
    elif choice == "4":
        continuous_monitoring(5)
    else:
        print("❌ Invalid choice. Please run again and choose 1-4.")
