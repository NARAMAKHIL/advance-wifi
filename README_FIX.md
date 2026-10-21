# WiFiSense 3D: Live ESP32 + Clearly Labeled Demo Mode Fix

## Why this fix is needed

The GitHub Pages deployment is a static frontend. It cannot run the FastAPI serial backend on the viewer's laptop, and its current offline fallbacks can make old sample records appear to be hardware telemetry. This bundle separates **Demo Data** from **Live ESP32** and uses browser Web Serial for the direct live path.

## Files included

- `apply_wifisense_fix.py` — safe local patcher for the existing repository; creates timestamped backups before writing.
- `frontend_src/LiveSerialPanel.tsx` — direct browser serial panel, JSON-line firmware protocol, legacy CSV-line compatibility, real-only CSV export.
- `frontend_src/liveData.ts` — summaries and RSSI interpolation from live samples only; requires at least three non-collinear valid positions before drawing a 2D map.
- `scripts/esp32_csv_logger.py` — Python alternative that collects from USB serial and writes a timestamped CSV on the laptop.

## Apply the patch on your computer

1. Download and extract this bundle.
2. Download/clone your repository `https://github.com/NARAMAKHIL/advance-wifi` to your computer, if not already present.
3. Close Arduino Serial Monitor and any Python script using the ESP32 COM port.
4. Open Command Prompt in the extracted bundle folder and run:

   `python apply_wifisense_fix.py C:\path\to\advance-wifi`

   Replace the path with your actual repository folder. The script stops without writing if an expected source block isn't found. It also saves timestamped `.bak_...` copies of three edited files.
5. From the repository's `frontend` folder run `npm ci`, then `npm run build`. Resolve any reported issue before publishing.
6. Review the diff, commit the changes and push them to `main` so GitHub Actions redeploys Pages.
7. Open the site in desktop **Chrome or Edge** at the HTTPS GitHub Pages URL. Click **Live ESP32 → Connect ESP32**, choose the board's serial device in the browser permission dialog, set the target SSID and coordinates, and click **Acquire point samples**.

## Firmware required for full dashboard controls

Upload the repository's existing `firmware/wifisense_esp32/wifisense_esp32.ino` using Arduino IDE. It expects the **ArduinoJson 7.x** library, 115200 baud, and one JSON object per serial line. It supports `PING`, `SCAN`, `START`, `STOP`, and `STATUS` commands. Close the Arduino Serial Monitor before using the browser connection.

The live panel also recognises the simple CSV serial output used in the earlier sketch, but that simpler firmware cannot respond to the dashboard's START/STOP commands. Use the repository's JSON-line firmware for the complete experience.

## Demo vs live behaviour

- The site defaults to **Demo Data** with a visible “SIMULATED — NOT LIVE” notice.
- The disconnected state no longer claims an ESP32 is connected.
- Switching to **Live ESP32** shows only live records and no longer falls back to demo values for its KPIs or heatmap.
- Live records are held in browser memory during the session; use **Download live CSV** to save them. A hosted static site does not automatically write files to your laptop.
- The heatmap is only drawn once valid readings exist at three or more non-collinear coordinates. A single location with ten time samples is a stability test, not a spatial heatmap.
- The interpolated surface is an estimate between measured coordinates, not a set of extra physical measurements.

## Python alternative and comparison

### Option A: Browser Web Serial (best for live website demo)

- Connect and see measurements directly in the dashboard.
- Uses desktop Chrome/Edge on HTTPS and the browser's USB serial permission.
- Click **Download live CSV** to save a file from the browser.
- No Python backend needs to run.
- The browser owns the serial port while connected, so Python/Arduino Serial Monitor cannot use it simultaneously.

### Option B: Python serial logger (best for laptop CSV collection)

Install:

`python -m pip install pyserial`

Example for a Windows ESP32 on COM6:

`python scripts/esp32_csv_logger.py --port COM6 --ssid "Your Wi-Fi SSID" --x 0 --y 0 --count 10 --interval-ms 5000`

Use a different X/Y coordinate each time you move the ESP32. The script writes a timestamped CSV in the current folder; choose `--output rssi_data.csv` to specify a fixed file name. It expects the repository's JSON-line firmware, not the simple sketch that only prints CSV text.

| Feature | Browser Web Serial | Python logger |
|---|---|---|
| Live dashboard updated while measuring | Yes | No, it writes a local CSV only |
| Automatic laptop CSV | Download button after/while capture | Yes, streams directly to CSV |
| Needs Python install | No | Yes (`pyserial`) |
| Works on GitHub Pages | Yes, in supported desktop browser | Python runs separately on your computer |
| Can share COM port with Serial Monitor | No | No |
| Best use | Live dashboard demonstration | Reliable field survey and MATLAB dataset |

Choose one acquisition client at a time. Do not open the browser serial connection and Python logger on the same USB COM port simultaneously.

## What is deliberately not claimed

This patch does not claim that GitHub Pages has a persistent backend, that the site writes directly to an online file, or that simulated/example measurements are real. Each live capture is marked `collection_source = esp32`; demo records are marked `simulation`.
