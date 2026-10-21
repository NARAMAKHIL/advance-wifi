"""
WiFiSense 3D - Data Store Service
===================================
Handles CSV persistence, data loading, validation, and export.
Thread-safe file operations for measurement data.
"""
from __future__ import annotations

import csv
import io
import os
import threading
from datetime import datetime
from pathlib import Path
from typing import Optional

import pandas as pd

from app.models import (
    CollectionSource,
    RSSIMeasurement,
    ScanStatus,
    SessionInfo,
)

# CSV column order — canonical schema
CSV_COLUMNS = [
    "timestamp_iso",
    "session_id",
    "measurement_id",
    "sample_index",
    "node_id",
    "target_ssid",
    "bssid",
    "channel",
    "rssi_dbm",
    "x_m",
    "y_m",
    "z_m",
    "scan_status",
    "collection_source",
]


class DataStore:
    """Thread-safe CSV-based measurement data store."""

    def __init__(self, data_dir: str = "data/real") -> None:
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._measurements: list[RSSIMeasurement] = []
        self._sessions: dict[str, SessionInfo] = {}
        self._current_file: Optional[Path] = None
        self._load_existing_data()

    def _get_data_file(self, session_id: str = "") -> Path:
        """Get the CSV file path for the current/specified session."""
        if session_id:
            return self.data_dir / f"wifisense_{session_id}.csv"
        today = datetime.now().strftime("%Y%m%d")
        return self.data_dir / f"wifisense_{today}.csv"

    def _load_existing_data(self) -> None:
        """Load any existing CSV files from the data directory."""
        for csv_file in sorted(self.data_dir.glob("wifisense_*.csv")):
            try:
                self._load_csv_file(csv_file)
            except Exception as e:
                print(f"Warning: Could not load {csv_file}: {e}")

    def _load_csv_file(self, filepath: Path) -> None:
        """Load measurements from a single CSV file."""
        if not filepath.exists() or filepath.stat().st_size == 0:
            return

        try:
            df = pd.read_csv(filepath, dtype=str)
        except Exception:
            return

        for _, row in df.iterrows():
            try:
                rssi = row.get("rssi_dbm", "")
                rssi_val = float(rssi) if rssi and rssi != "" and rssi.lower() != "nan" else None

                m = RSSIMeasurement(
                    timestamp_iso=str(row.get("timestamp_iso", "")),
                    session_id=str(row.get("session_id", "")),
                    measurement_id=str(row.get("measurement_id", "")),
                    sample_index=int(float(row.get("sample_index", 1))),
                    node_id=str(row.get("node_id", "ESP32_01")),
                    target_ssid=str(row.get("target_ssid", "")),
                    bssid=str(row.get("bssid", "")),
                    channel=int(float(row.get("channel", 0))),
                    rssi_dbm=rssi_val,
                    x_m=float(row.get("x_m", 0)),
                    y_m=float(row.get("y_m", 0)),
                    z_m=float(row.get("z_m", 1.0)),
                    scan_status=ScanStatus(row.get("scan_status", "ok")),
                    collection_source=CollectionSource(row.get("collection_source", "esp32")),
                )
                self._measurements.append(m)
            except (ValueError, KeyError) as e:
                print(f"Warning: Skipped invalid row: {e}")

    def add_measurement(self, measurement: RSSIMeasurement) -> None:
        """Add a single measurement and persist to CSV."""
        with self._lock:
            self._measurements.append(measurement)
            self._append_to_csv(measurement)

    def add_measurements(self, measurements: list[RSSIMeasurement]) -> None:
        """Add multiple measurements and persist to CSV."""
        with self._lock:
            for m in measurements:
                self._measurements.append(m)
                self._append_to_csv(m)

    def _append_to_csv(self, measurement: RSSIMeasurement) -> None:
        """Append a single measurement row to the CSV file."""
        filepath = self._get_data_file(measurement.session_id)
        file_exists = filepath.exists() and filepath.stat().st_size > 0

        try:
            with open(filepath, "a", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
                if not file_exists:
                    writer.writeheader()
                row = measurement.model_dump()
                # Convert enum values to strings
                row["scan_status"] = row["scan_status"].value if hasattr(row["scan_status"], "value") else str(row["scan_status"])
                row["collection_source"] = row["collection_source"].value if hasattr(row["collection_source"], "value") else str(row["collection_source"])
                # Handle None RSSI
                if row["rssi_dbm"] is None:
                    row["rssi_dbm"] = ""
                writer.writerow(row)
        except OSError as e:
            print(f"Error writing to CSV: {e}")

    def get_measurements(
        self,
        session_id: Optional[str] = None,
        source: Optional[CollectionSource] = None,
    ) -> list[RSSIMeasurement]:
        """Get measurements with optional filtering."""
        result = self._measurements
        if session_id:
            result = [m for m in result if m.session_id == session_id]
        if source:
            result = [m for m in result if m.collection_source == source]
        return result

    def get_valid_measurements(
        self, session_id: Optional[str] = None
    ) -> list[RSSIMeasurement]:
        """Get only measurements with valid RSSI values."""
        measurements = self.get_measurements(session_id=session_id)
        return [
            m for m in measurements
            if m.rssi_dbm is not None and m.scan_status in (ScanStatus.OK, ScanStatus.SIMULATED)
        ]

    def get_sessions(self) -> list[SessionInfo]:
        """Get all known sessions."""
        # Build session info from measurements
        sessions: dict[str, SessionInfo] = {}
        for m in self._measurements:
            if m.session_id not in sessions:
                sessions[m.session_id] = SessionInfo(
                    session_id=m.session_id,
                    target_ssid=m.target_ssid,
                    node_id=m.node_id,
                    collection_source=m.collection_source,
                )
            s = sessions[m.session_id]
            s.total_measurements += 1
        # Count unique locations per session
        for sid, session in sessions.items():
            ms = [m for m in self._measurements if m.session_id == sid]
            locs = set((m.x_m, m.y_m, m.z_m) for m in ms)
            session.total_locations = len(locs)
        return list(sessions.values())

    def get_unique_locations(
        self, session_id: Optional[str] = None
    ) -> list[tuple[float, float, float]]:
        """Get unique (x, y, z) measurement locations."""
        measurements = self.get_valid_measurements(session_id=session_id)
        return list(set((m.x_m, m.y_m, m.z_m) for m in measurements))

    def clear_session(self, session_id: str) -> int:
        """Remove all measurements for a session. Returns count removed."""
        with self._lock:
            before = len(self._measurements)
            self._measurements = [m for m in self._measurements if m.session_id != session_id]
            removed = before - len(self._measurements)
            # Remove CSV file
            filepath = self._get_data_file(session_id)
            if filepath.exists():
                filepath.unlink()
            return removed

    def export_csv(self, session_id: Optional[str] = None) -> str:
        """Export measurements as CSV string."""
        measurements = self.get_measurements(session_id=session_id)
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for m in measurements:
            row = m.model_dump()
            row["scan_status"] = row["scan_status"].value if hasattr(row["scan_status"], "value") else str(row["scan_status"])
            row["collection_source"] = row["collection_source"].value if hasattr(row["collection_source"], "value") else str(row["collection_source"])
            if row["rssi_dbm"] is None:
                row["rssi_dbm"] = ""
            writer.writerow(row)
        return output.getvalue()

    def import_csv(self, csv_content: str, source: CollectionSource = CollectionSource.IMPORTED) -> int:
        """Import measurements from CSV string. Returns count imported."""
        count = 0
        reader = csv.DictReader(io.StringIO(csv_content))
        for row in reader:
            try:
                rssi = row.get("rssi_dbm", "")
                rssi_val = float(rssi) if rssi and rssi.lower() != "nan" else None

                m = RSSIMeasurement(
                    timestamp_iso=row.get("timestamp_iso", datetime.now().isoformat()),
                    session_id=row.get("session_id", "imported"),
                    measurement_id=row.get("measurement_id", ""),
                    sample_index=int(float(row.get("sample_index", 1))),
                    node_id=row.get("node_id", "imported"),
                    target_ssid=row.get("target_ssid", ""),
                    bssid=row.get("bssid", ""),
                    channel=int(float(row.get("channel", 0))),
                    rssi_dbm=rssi_val,
                    x_m=float(row.get("x_m", 0)),
                    y_m=float(row.get("y_m", 0)),
                    z_m=float(row.get("z_m", 1.0)),
                    scan_status=ScanStatus(row.get("scan_status", "ok")),
                    collection_source=source,
                )
                self.add_measurement(m)
                count += 1
            except (ValueError, KeyError) as e:
                print(f"Import skipped row: {e}")
        return count

    @property
    def total_count(self) -> int:
        return len(self._measurements)

    @property
    def valid_count(self) -> int:
        return len([m for m in self._measurements if m.rssi_dbm is not None])
