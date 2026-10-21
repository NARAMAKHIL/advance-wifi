#!/usr/bin/env python3
"""WiFiSense 3D: collect ESP32 RSSI measurements into a local CSV.

Install: python -m pip install pyserial
Example (Windows):
  python scripts/esp32_csv_logger.py --port COM6 --ssid "Your Wi-Fi SSID" --x 0 --y 0 --count 10 --interval-ms 5000
Requires firmware/wifisense_esp32/wifisense_esp32.ino (JSON Lines, 115200 baud).
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    import serial
    from serial.tools import list_ports
except ImportError:
    print("Install pyserial first: python -m pip install pyserial", file=sys.stderr)
    raise SystemExit(1)

FIELDS = [
    "timestamp_iso", "session_id", "measurement_id", "sample_index",
    "node_id", "target_ssid", "bssid", "channel", "rssi_dbm",
    "x_m", "y_m", "z_m", "scan_status", "collection_source",
]


def choose_port(requested: str | None) -> str:
    if requested:
        return requested
    ports = list(list_ports.comports())
    if not ports:
        raise RuntimeError("No serial ports detected. Check the USB data cable and Windows Device Manager.")
    print("Detected serial ports:")
    for index, port in enumerate(ports, start=1):
        print(f"  {index}. {port.device} - {port.description}")
    try:
        return ports[int(input("Choose port number: ").strip()) - 1].device
    except (ValueError, IndexError):
        raise RuntimeError("Invalid port selection.")


def main() -> int:
    parser = argparse.ArgumentParser(description="Collect real ESP32 RSSI measurements and save them to CSV.")
    parser.add_argument("--port", help="Windows serial port such as COM6; prompt if omitted")
    parser.add_argument("--baud", type=int, default=115200)
    parser.add_argument("--ssid", required=True, help="Exact target Wi-Fi SSID")
    parser.add_argument("--x", type=float, default=0.0, help="Survey X coordinate in metres")
    parser.add_argument("--y", type=float, default=0.0, help="Survey Y coordinate in metres")
    parser.add_argument("--z", type=float, default=1.0, help="Sensor height in metres")
    parser.add_argument("--count", type=int, default=10, help="Readings per location, 1-100")
    parser.add_argument("--interval-ms", type=int, default=5000, help="Interval in milliseconds, 1000-60000")
    parser.add_argument("--output", help="Output CSV file; default is timestamped in the current folder")
    args = parser.parse_args()

    if not args.ssid.strip():
        parser.error("--ssid cannot be empty")
    if not 1 <= args.count <= 100:
        parser.error("--count must be from 1 through 100")
    if not 1000 <= args.interval_ms <= 60000:
        parser.error("--interval-ms must be between 1000 and 60000")
    if args.baud <= 0:
        parser.error("--baud must be positive")

    try:
        port_name = choose_port(args.port)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    session_id = "live_" + datetime.now().strftime("%Y%m%d_%H%M%S")
    output = Path(args.output or ("rssi_data_" + datetime.now().strftime("%Y%m%d_%H%M%S") + ".csv"))
    output.parent.mkdir(parents=True, exist_ok=True)
    saved = 0
    timeout_seconds = max(90, args.count * (args.interval_ms / 1000 + 8))

    print("Serial port:", port_name)
    print("Target SSID:", args.ssid)
    print("CSV output:", output.resolve())
    print("Close Arduino Serial Monitor before collecting.")

    try:
        # Opening the port can reset the ESP32; wait for boot before sending START.
        with serial.Serial(port_name, args.baud, timeout=1, write_timeout=3) as device:
            time.sleep(2)
            device.reset_input_buffer()
            command = {
                "command": "START", "count": args.count,
                "interval_ms": args.interval_ms, "ssid": args.ssid.strip(),
                "bssid": "", "x_m": args.x, "y_m": args.y, "z_m": args.z,
            }
            device.write((json.dumps(command) + "\n").encode("utf-8"))
            device.flush()

            with output.open("w", newline="", encoding="utf-8") as stream:
                writer = csv.DictWriter(stream, fieldnames=FIELDS)
                writer.writeheader()
                stream.flush()
                deadline = time.monotonic() + timeout_seconds
                print("Waiting for ESP32 measurement records...")
                while saved < args.count and time.monotonic() < deadline:
                    line = device.readline().decode("utf-8", errors="replace").strip()
                    if not line:
                        continue
                    try:
                        message = json.loads(line)
                    except json.JSONDecodeError:
                        print("Device:", line[:100])
                        continue

                    kind = message.get("type")
                    if kind == "ready":
                        print("ESP32 ready:", message.get("node_id", "ESP32"))
                    elif kind == "error":
                        print("ESP32 error:", message.get("message", message.get("code", "unknown")))
                    elif kind == "measurement":
                        raw_rssi = message.get("rssi_dbm")
                        valid = isinstance(raw_rssi, (int, float)) and -120 <= float(raw_rssi) <= 0
                        row = {
                            "timestamp_iso": datetime.now().astimezone().isoformat(timespec="seconds"),
                            "session_id": session_id,
                            "measurement_id": "meas_" + str(message.get("measurement_id", "")) + "_" + str(message.get("sample_index", saved + 1)),
                            "sample_index": message.get("sample_index", saved + 1),
                            "node_id": message.get("node_id", "ESP32"),
                            "target_ssid": message.get("target_ssid", args.ssid),
                            "bssid": message.get("bssid", ""),
                            "channel": message.get("channel", ""),
                            "rssi_dbm": float(raw_rssi) if valid else "",
                            "x_m": message.get("x_m", args.x),
                            "y_m": message.get("y_m", args.y),
                            "z_m": message.get("z_m", args.z),
                            "scan_status": message.get("scan_status", "ok" if valid else "target_not_found"),
                            "collection_source": "esp32",
                        }
                        writer.writerow(row)
                        stream.flush()
                        saved += 1
                        print(f"{saved}/{args.count}: {row['rssi_dbm'] if valid else 'target not found'} at ({row['x_m']}, {row['y_m']})")
                    elif kind == "batch_complete":
                        print("Batch complete:", message.get("valid_samples", 0), "valid of", message.get("total_samples", 0))
                        break

        print(f"Saved {saved} row(s) to {output.resolve()}")
        if saved == 0:
            print("No measurements received. Confirm WiFiSense JSON firmware is installed and the port is correct.", file=sys.stderr)
            return 1
        return 0
    except serial.SerialException as exc:
        print("Serial error:", exc, file=sys.stderr)
        print("Check COM port and close Arduino Serial Monitor.", file=sys.stderr)
        return 1
    except OSError as exc:
        print("File error:", exc, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
