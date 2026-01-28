# IoT Dashboard - User Guide

Dưới đây là các bước để cài đặt và chạy hệ thống dashboard giám sát nhiệt độ.

## 1. Mở Terminal
Đảm bảo bạn đang ở thư mục dự án:
```powershell
cd D:\IOT\IOT_Dashboard
```

## 2. Cài đặt thư viện
Cài đặt các thư viện Python cần thiết (FastAPI, SQLModel, Uvicorn, Jinja2):
```powershell
pip install -r requirements.txt
```

## 3. Chạy Server
Khởi chạy web server với Uvicorn:
```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*Server sẽ chạy tại địa chỉ: `http://localhost:8000`*

## 4. Kiểm tra hoạt động

### Xem Dashboard
Mở trình duyệt và truy cập: **[http://localhost:8000](http://localhost:8000)**

### Gửi dữ liệu mẫu (Test API)
Để kiểm tra biểu đồ cập nhật, bạn cần gửi dữ liệu giả lập. Mở một terminal khác (PowerShell) và chạy lệnh sau:

```powershell
$body = @{
    device_id = "esp32_sensor_01"
    interval_s = 10
    unit = "C"
    ts = [int][double]::Parse((Get-Date -UFormat %s))
    temperatures = @{
        inside = @{ sensor_id = "temp_in_1"; value = 27.5 }
        outside = @{ sensor_id = "temp_out_1"; value = 32.1 }
    }
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:8000/api/telemetry" -Method Post -Body $body -ContentType "application/json"
```

Bạn có thể chạy lệnh trên nhiều lần (thay đổi giá trị `value`) để thấy biểu đồ thay đổi.
