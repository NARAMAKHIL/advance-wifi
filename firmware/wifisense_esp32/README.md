# WiFiSense 3D - ESP32 Firmware

## Hardware Requirements
- ESP32 Dev Module (ESP32-WROOM-32 or compatible)
- USB cable (data-capable, not charge-only)

## Software Requirements
- Arduino IDE 2.x (or Arduino CLI)
- ESP32 board package (by Espressif Systems)
- ArduinoJson library v7.x

## Setup Instructions

### 1. Install ESP32 Board Package
1. Open Arduino IDE → File → Preferences
2. Add to "Additional Board Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Tools → Board → Board Manager → Search "esp32" → Install

### 2. Install ArduinoJson Library
1. Sketch → Include Library → Manage Libraries
2. Search "ArduinoJson" by Benoit Blanchon
3. Install version 7.x

### 3. Board Configuration
- Board: "ESP32 Dev Module"
- Upload Speed: 921600
- CPU Frequency: 240MHz
- Flash Frequency: 80MHz
- Flash Mode: QIO
- Flash Size: 4MB
- Partition Scheme: Default 4MB with spiffs
- Port: Select your COM port (check Device Manager)

### 4. Upload
1. Connect ESP32 via USB
2. Select the correct COM port in Tools → Port
3. Click Upload
4. Open Serial Monitor at 115200 baud
5. You should see: `{"type":"ready","firmware":"WiFiSense3D","version":"1.0.0","node_id":"ESP32_01"}`

## Serial Protocol
- Baud rate: 115200
- Format: JSON Lines (one JSON object per line)
- Line ending: `\n`

### Commands (Laptop → ESP32)
| Command | Description |
|---------|-------------|
| `{"command":"PING"}` | Check connectivity |
| `{"command":"SCAN"}` | Scan all nearby networks |
| `{"command":"START","count":10,"interval_ms":5000,"ssid":"YourWiFi","x_m":1.0,"y_m":2.0,"z_m":1.0}` | Start measurement batch |
| `{"command":"STOP"}` | Stop current measurement |
| `{"command":"STATUS"}` | Get current device status |
| `{"command":"SET_NODE","node_id":"ESP32_01"}` | Set device identifier |

### Responses (ESP32 → Laptop)
See the firmware source code header for complete response schema documentation.

## Troubleshooting
- **No COM port visible**: Try a different USB cable (must be data-capable)
- **Upload fails**: Hold BOOT button on ESP32 during upload
- **No serial output**: Verify baud rate is 115200
- **WiFi scan returns 0 networks**: Ensure antenna is not obstructed
