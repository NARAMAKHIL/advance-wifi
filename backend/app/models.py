"""
WiFiSense 3D - Data Models
============================
Pydantic models for API requests/responses and internal data structures.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ─── Enums ────────────────────────────────────────────────────────
class ScanStatus(str, Enum):
    OK = "ok"
    TARGET_NOT_FOUND = "target_not_found"
    SCAN_FAILED = "scan_failed"
    SIMULATED = "simulated"


class CollectionSource(str, Enum):
    ESP32 = "esp32"
    SIMULATION = "simulation"
    IMPORTED = "imported"


class DeviceState(str, Enum):
    DISCONNECTED = "disconnected"
    CONNECTED = "connected"
    SCANNING = "scanning"
    MEASURING = "measuring"
    ERROR = "error"


# ─── Measurement Models ──────────────────────────────────────────
class RSSIMeasurement(BaseModel):
    """A single RSSI measurement sample."""
    timestamp_iso: str = Field(description="ISO-8601 timestamp from laptop clock")
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    measurement_id: str = Field(default="")
    sample_index: int = Field(ge=1)
    node_id: str = Field(default="ESP32_01")
    target_ssid: str = Field(default="")
    bssid: str = Field(default="")
    channel: int = Field(default=0)
    rssi_dbm: Optional[float] = Field(default=None, description="RSSI in dBm, null if scan failed")
    x_m: float = Field(default=0.0, description="X coordinate in metres")
    y_m: float = Field(default=0.0, description="Y coordinate in metres")
    z_m: float = Field(default=1.0, description="Z coordinate (height) in metres")
    scan_status: ScanStatus = Field(default=ScanStatus.OK)
    collection_source: CollectionSource = Field(default=CollectionSource.ESP32)


class LocationSummary(BaseModel):
    """Aggregated statistics for a single measurement location."""
    x_m: float
    y_m: float
    z_m: float
    mean_rssi: Optional[float] = None
    std_rssi: Optional[float] = None
    min_rssi: Optional[float] = None
    max_rssi: Optional[float] = None
    range_rssi: Optional[float] = None
    sample_count: int = 0
    valid_count: int = 0
    stability_score: Optional[float] = None
    session_id: str = ""


class SessionInfo(BaseModel):
    """Metadata about a collection session."""
    session_id: str
    experiment_name: str = ""
    room_name: str = ""
    room_width_m: float = 10.0
    room_length_m: float = 10.0
    room_height_m: Optional[float] = None
    target_ssid: str = ""
    target_bssid: str = ""
    node_id: str = "ESP32_01"
    samples_per_batch: int = 10
    interval_ms: int = 5000
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    total_measurements: int = 0
    total_locations: int = 0
    collection_source: CollectionSource = CollectionSource.ESP32


# ─── Serial / Device Models ──────────────────────────────────────
class SerialConfig(BaseModel):
    """Serial port connection configuration."""
    port: str
    baud_rate: int = 115200


class SerialStatus(BaseModel):
    """Current serial connection status."""
    connected: bool = False
    port: Optional[str] = None
    baud_rate: int = 115200
    device_state: DeviceState = DeviceState.DISCONNECTED
    node_id: str = ""
    firmware_version: str = ""
    last_message_at: Optional[str] = None


class PortInfo(BaseModel):
    """Available serial port information."""
    port: str
    description: str = ""
    hardware_id: str = ""


# ─── API Request Models ──────────────────────────────────────────
class StartMeasurementRequest(BaseModel):
    """Request to start a measurement batch."""
    target_ssid: str
    target_bssid: str = ""
    x_m: float = 0.0
    y_m: float = 0.0
    z_m: float = 1.0
    count: int = Field(default=10, ge=1, le=100)
    interval_ms: int = Field(default=5000, ge=1000, le=60000)
    session_id: Optional[str] = None
    experiment_name: str = ""
    room_name: str = ""
    room_width_m: float = 10.0
    room_length_m: float = 10.0


class ImportDataRequest(BaseModel):
    """Request metadata for CSV import."""
    session_id: Optional[str] = None
    collection_source: CollectionSource = CollectionSource.IMPORTED


# ─── API Response Models ─────────────────────────────────────────
class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    uptime_seconds: float = 0.0
    serial_connected: bool = False
    data_points: int = 0


class AnalyticsSummary(BaseModel):
    """Overall analytics summary for collected data."""
    total_samples: int = 0
    valid_samples: int = 0
    total_locations: int = 0
    sessions: int = 0
    overall_mean_rssi: Optional[float] = None
    overall_std_rssi: Optional[float] = None
    overall_min_rssi: Optional[float] = None
    overall_max_rssi: Optional[float] = None
    valid_ratio: Optional[float] = None
    last_measurement_at: Optional[str] = None
    collection_source: str = ""


class HeatmapData(BaseModel):
    """Data for 2D/3D heatmap visualization."""
    locations: list[LocationSummary] = []
    grid_x: list[list[float]] = []
    grid_y: list[list[float]] = []
    grid_rssi: list[list[Optional[float]]] = []
    interpolation_method: str = "linear"
    room_width_m: float = 10.0
    room_length_m: float = 10.0
    measured_count: int = 0
    has_sufficient_data: bool = False
    warnings: list[str] = []


class SurveyRecommendation(BaseModel):
    """Recommended next measurement location."""
    x_m: float
    y_m: float
    reason: str = ""
    priority: float = 0.0  # higher = more important
