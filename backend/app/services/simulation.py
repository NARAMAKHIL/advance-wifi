"""
WiFiSense 3D - Simulation Service
====================================
Generates clearly labelled synthetic RSSI data for UI development
and demonstration purposes. All synthetic data is explicitly marked.

THIS IS NOT REAL DATA. It uses a simplified log-distance path loss model
to produce plausible but entirely hypothetical RSSI values.
"""
from __future__ import annotations

import math
import random
import uuid
from datetime import datetime, timedelta
from typing import Optional

from app.models import (
    CollectionSource,
    RSSIMeasurement,
    ScanStatus,
)


class SimulationService:
    """Generates synthetic RSSI data for demonstration and UI testing."""

    def __init__(self) -> None:
        self.ap_position = (5.0, 5.0)  # Hypothetical AP at center
        self.reference_rssi = -30.0    # RSSI at 1 metre (hypothetical)
        self.path_loss_exp = 3.0       # Path loss exponent (indoor)
        self.noise_std = 3.0           # Random noise std in dB

    def generate_room_survey(
        self,
        room_width: float = 8.0,
        room_length: float = 6.0,
        grid_spacing: float = 1.0,
        samples_per_point: int = 10,
        target_ssid: str = "DemoWiFi_SYNTHETIC",
        session_id: Optional[str] = None,
    ) -> list[RSSIMeasurement]:
        """
        Generate a synthetic room survey dataset.

        All data is clearly labelled with:
        - collection_source = "simulation"
        - scan_status = "simulated"
        - target_ssid contains "SYNTHETIC"

        Uses a simplified log-distance path loss model:
            RSSI(d) = RSSI_ref - 10 * n * log10(d) + noise

        This is a hypothetical model for UI demonstration only.
        """
        if session_id is None:
            session_id = f"sim_{uuid.uuid4().hex[:6]}"

        measurements: list[RSSIMeasurement] = []
        measurement_id = 0
        base_time = datetime.now() - timedelta(hours=1)

        # Generate grid points
        x_points = _frange(grid_spacing / 2, room_width, grid_spacing)
        y_points = _frange(grid_spacing / 2, room_length, grid_spacing)

        for x in x_points:
            for y in y_points:
                measurement_id += 1
                for sample in range(1, samples_per_point + 1):
                    # Compute hypothetical RSSI
                    dist = math.sqrt(
                        (x - self.ap_position[0]) ** 2 +
                        (y - self.ap_position[1]) ** 2
                    )
                    dist = max(dist, 0.1)  # Avoid log(0)

                    rssi = (
                        self.reference_rssi
                        - 10 * self.path_loss_exp * math.log10(dist)
                        + random.gauss(0, self.noise_std)
                    )
                    rssi = max(min(rssi, -10), -100)  # Clamp to plausible range

                    timestamp = base_time + timedelta(
                        seconds=measurement_id * 60 + sample * 5
                    )

                    measurements.append(RSSIMeasurement(
                        timestamp_iso=timestamp.isoformat(),
                        session_id=session_id,
                        measurement_id=str(measurement_id),
                        sample_index=sample,
                        node_id="SIM_NODE",
                        target_ssid=target_ssid,
                        bssid="00:00:00:00:00:00",
                        channel=6,
                        rssi_dbm=round(rssi, 1),
                        x_m=round(x, 2),
                        y_m=round(y, 2),
                        z_m=1.0,
                        scan_status=ScanStatus.SIMULATED,
                        collection_source=CollectionSource.SIMULATION,
                    ))

        return measurements

    def generate_single_batch(
        self,
        x_m: float,
        y_m: float,
        z_m: float = 1.0,
        count: int = 10,
        interval_ms: int = 5000,
        target_ssid: str = "DemoWiFi_SYNTHETIC",
        session_id: str = "",
    ) -> list[RSSIMeasurement]:
        """Generate a single simulated measurement batch at a specific location."""
        if not session_id:
            session_id = f"sim_{uuid.uuid4().hex[:6]}"

        measurements = []
        base_time = datetime.now()

        dist = math.sqrt(
            (x_m - self.ap_position[0]) ** 2 +
            (y_m - self.ap_position[1]) ** 2
        )
        dist = max(dist, 0.1)

        for sample in range(1, count + 1):
            rssi = (
                self.reference_rssi
                - 10 * self.path_loss_exp * math.log10(dist)
                + random.gauss(0, self.noise_std)
            )
            rssi = max(min(rssi, -10), -100)

            timestamp = base_time + timedelta(milliseconds=sample * interval_ms)

            measurements.append(RSSIMeasurement(
                timestamp_iso=timestamp.isoformat(),
                session_id=session_id,
                measurement_id="sim_batch",
                sample_index=sample,
                node_id="SIM_NODE",
                target_ssid=target_ssid,
                bssid="00:00:00:00:00:00",
                channel=6,
                rssi_dbm=round(rssi, 1),
                x_m=x_m,
                y_m=y_m,
                z_m=z_m,
                scan_status=ScanStatus.SIMULATED,
                collection_source=CollectionSource.SIMULATION,
            ))

        return measurements


def _frange(start: float, stop: float, step: float) -> list[float]:
    """Generate float range."""
    result = []
    current = start
    while current < stop:
        result.append(round(current, 2))
        current += step
    return result
