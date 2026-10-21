"""
WiFiSense 3D - Serial Manager Service
=======================================
Manages ESP32 serial communication, command sending,
and measurement data reception via JSON Lines protocol.
"""
from __future__ import annotations

import json
import threading
import time
from datetime import datetime
from typing import Callable, Optional

import serial
import serial.tools.list_ports

from app.models import (
    CollectionSource,
    DeviceState,
    PortInfo,
    RSSIMeasurement,
    ScanStatus,
    SerialStatus,
)


class SerialManager:
    """Manages serial connection to the ESP32 WiFiSense node."""

    def __init__(self) -> None:
        self._serial: Optional[serial.Serial] = None
        self._lock = threading.Lock()
        self._reader_thread: Optional[threading.Thread] = None
        self._running = False

        # State
        self.state = DeviceState.DISCONNECTED
        self.port: Optional[str] = None
        self.baud_rate = 115200
        self.node_id = ""
        self.firmware_version = ""
        self.last_message_at: Optional[str] = None

        # Measurement state
        self._measuring = False
        self._current_session_id = ""
        self._current_measurement_id = ""

        # Callbacks
        self._on_measurement: Optional[Callable[[RSSIMeasurement], None]] = None
        self._on_event: Optional[Callable[[dict], None]] = None
        self._on_batch_complete: Optional[Callable[[dict], None]] = None

        # Event buffer for websocket consumers
        self._event_buffer: list[dict] = []
        self._event_buffer_max = 200

    @staticmethod
    def list_ports() -> list[PortInfo]:
        """List available serial ports."""
        ports = serial.tools.list_ports.comports()
        return [
            PortInfo(
                port=p.device,
                description=p.description or "",
                hardware_id=p.hwid or "",
            )
            for p in ports
        ]

    def connect(self, port: str, baud_rate: int = 115200) -> bool:
        """Connect to the ESP32 on the specified port."""
        with self._lock:
            if self._serial and self._serial.is_open:
                self.disconnect()

            try:
                self._serial = serial.Serial(
                    port=port,
                    baudrate=baud_rate,
                    timeout=1,
                    write_timeout=2,
                )
                self.port = port
                self.baud_rate = baud_rate
                self.state = DeviceState.CONNECTED
                self._running = True

                # Start reader thread
                self._reader_thread = threading.Thread(
                    target=self._read_loop, daemon=True
                )
                self._reader_thread.start()

                # Give it a moment, then ping
                time.sleep(1.5)
                self.send_command({"command": "PING"})

                self._push_event({
                    "type": "serial_connected",
                    "port": port,
                    "baud_rate": baud_rate,
                })
                return True

            except (serial.SerialException, OSError) as e:
                self.state = DeviceState.ERROR
                self._push_event({
                    "type": "serial_error",
                    "message": str(e),
                })
                return False

    def disconnect(self) -> None:
        """Disconnect from the ESP32."""
        self._running = False
        self._measuring = False

        with self._lock:
            if self._serial and self._serial.is_open:
                try:
                    self._serial.close()
                except Exception:
                    pass
            self._serial = None

        self.state = DeviceState.DISCONNECTED
        self.port = None
        self.node_id = ""
        self.firmware_version = ""

        self._push_event({"type": "serial_disconnected"})

    def send_command(self, command: dict) -> bool:
        """Send a JSON command to the ESP32."""
        with self._lock:
            if not self._serial or not self._serial.is_open:
                return False
            try:
                line = json.dumps(command) + "\n"
                self._serial.write(line.encode("utf-8"))
                self._serial.flush()
                return True
            except (serial.SerialException, OSError) as e:
                self._push_event({
                    "type": "serial_error",
                    "message": f"Send failed: {e}",
                })
                return False

    def start_measurement(
        self,
        target_ssid: str,
        x_m: float,
        y_m: float,
        z_m: float,
        count: int = 10,
        interval_ms: int = 5000,
        target_bssid: str = "",
        session_id: str = "",
        measurement_id: str = "",
    ) -> bool:
        """Send START command to begin a measurement batch."""
        if self._measuring:
            return False

        self._current_session_id = session_id
        self._current_measurement_id = measurement_id
        self._measuring = True

        return self.send_command({
            "command": "START",
            "ssid": target_ssid,
            "bssid": target_bssid,
            "count": count,
            "interval_ms": interval_ms,
            "x_m": x_m,
            "y_m": y_m,
            "z_m": z_m,
        })

    def stop_measurement(self) -> bool:
        """Send STOP command."""
        return self.send_command({"command": "STOP"})

    def scan_networks(self) -> bool:
        """Send SCAN command."""
        return self.send_command({"command": "SCAN"})

    def get_status(self) -> SerialStatus:
        """Get current serial connection status."""
        return SerialStatus(
            connected=self._serial is not None and self._serial.is_open if self._serial else False,
            port=self.port,
            baud_rate=self.baud_rate,
            device_state=self.state,
            node_id=self.node_id,
            firmware_version=self.firmware_version,
            last_message_at=self.last_message_at,
        )

    def get_events(self, since: int = 0) -> list[dict]:
        """Get buffered events since index."""
        if since >= len(self._event_buffer):
            return []
        return self._event_buffer[since:]

    def set_callbacks(
        self,
        on_measurement: Optional[Callable[[RSSIMeasurement], None]] = None,
        on_event: Optional[Callable[[dict], None]] = None,
        on_batch_complete: Optional[Callable[[dict], None]] = None,
    ) -> None:
        """Set callback functions for serial events."""
        self._on_measurement = on_measurement
        self._on_event = on_event
        self._on_batch_complete = on_batch_complete

    # ─── Internal ─────────────────────────────────────────────────
    def _read_loop(self) -> None:
        """Background thread: continuously read serial data."""
        while self._running:
            try:
                if not self._serial or not self._serial.is_open:
                    time.sleep(0.1)
                    continue

                line = self._serial.readline()
                if not line:
                    continue

                line_str = line.decode("utf-8", errors="replace").strip()
                if not line_str:
                    continue

                self._process_line(line_str)

            except (serial.SerialException, OSError) as e:
                if self._running:
                    self.state = DeviceState.ERROR
                    self._push_event({
                        "type": "serial_error",
                        "message": str(e),
                    })
                    self._running = False
            except Exception as e:
                self._push_event({
                    "type": "parse_error",
                    "message": str(e),
                })

    def _process_line(self, line: str) -> None:
        """Process a single JSON line from the ESP32."""
        self.last_message_at = datetime.now().isoformat()

        try:
            data = json.loads(line)
        except json.JSONDecodeError:
            self._push_event({
                "type": "raw_serial",
                "data": line,
            })
            return

        msg_type = data.get("type", "")

        if msg_type == "ready":
            self.node_id = data.get("node_id", "")
            self.firmware_version = data.get("version", "")
            self.state = DeviceState.CONNECTED
            self._push_event(data)

        elif msg_type == "pong":
            self.node_id = data.get("node_id", "")
            self.state = DeviceState.CONNECTED
            self._push_event(data)

        elif msg_type == "scan_result":
            self.state = DeviceState.CONNECTED
            self._push_event(data)

        elif msg_type == "scan_start":
            self.state = DeviceState.SCANNING
            self._push_event(data)

        elif msg_type == "batch_start":
            self.state = DeviceState.MEASURING
            self._push_event(data)

        elif msg_type == "measurement":
            self._handle_measurement(data)
            self._push_event(data)

        elif msg_type == "batch_complete":
            self._measuring = False
            self.state = DeviceState.CONNECTED
            self._push_event(data)
            if self._on_batch_complete:
                self._on_batch_complete(data)

        elif msg_type == "error":
            self._push_event(data)

        elif msg_type == "status":
            self._push_event(data)

        else:
            self._push_event(data)

    def _handle_measurement(self, data: dict) -> None:
        """Convert raw measurement data to RSSIMeasurement model."""
        rssi_raw = data.get("rssi_dbm")
        rssi_val = float(rssi_raw) if rssi_raw is not None else None
        scan_status_str = data.get("scan_status", "ok")

        try:
            scan_status = ScanStatus(scan_status_str)
        except ValueError:
            scan_status = ScanStatus.SCAN_FAILED

        measurement = RSSIMeasurement(
            timestamp_iso=datetime.now().isoformat(),
            session_id=self._current_session_id,
            measurement_id=str(data.get("measurement_id", "")),
            sample_index=data.get("sample_index", 0),
            node_id=data.get("node_id", "ESP32_01"),
            target_ssid=data.get("target_ssid", ""),
            bssid=data.get("bssid", ""),
            channel=data.get("channel", 0),
            rssi_dbm=rssi_val,
            x_m=data.get("x_m", 0.0),
            y_m=data.get("y_m", 0.0),
            z_m=data.get("z_m", 1.0),
            scan_status=scan_status,
            collection_source=CollectionSource.ESP32,
        )

        if self._on_measurement:
            self._on_measurement(measurement)

    def _push_event(self, event: dict) -> None:
        """Buffer an event for consumers."""
        event["_index"] = len(self._event_buffer)
        event["_timestamp"] = datetime.now().isoformat()
        self._event_buffer.append(event)

        # Trim buffer
        if len(self._event_buffer) > self._event_buffer_max:
            self._event_buffer = self._event_buffer[-self._event_buffer_max:]

        if self._on_event:
            try:
                self._on_event(event)
            except Exception:
                pass
