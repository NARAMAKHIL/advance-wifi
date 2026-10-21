"""
WiFiSense 3D - Backend Tests
===============================
Tests for data store, analytics, simulation, and API endpoints.
"""
from __future__ import annotations

import csv
import io
import os
import tempfile

import pytest
import numpy as np

from app.models import (
    CollectionSource,
    LocationSummary,
    RSSIMeasurement,
    ScanStatus,
)
from app.services.analytics import AnalyticsService, _are_collinear
from app.services.data_store import DataStore, CSV_COLUMNS
from app.services.simulation import SimulationService


# ─── Fixtures ─────────────────────────────────────────────────────
@pytest.fixture
def temp_data_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def store(temp_data_dir):
    return DataStore(data_dir=temp_data_dir)


@pytest.fixture
def sample_measurements() -> list[RSSIMeasurement]:
    """Create a set of sample measurements for testing."""
    measurements = []
    for i in range(10):
        measurements.append(RSSIMeasurement(
            timestamp_iso=f"2024-01-01T10:00:{i:02d}",
            session_id="test_session",
            measurement_id="m1",
            sample_index=i + 1,
            node_id="TEST_01",
            target_ssid="TestWiFi",
            bssid="AA:BB:CC:DD:EE:FF",
            channel=6,
            rssi_dbm=-50.0 - i * 0.5,
            x_m=1.0,
            y_m=2.0,
            z_m=1.0,
            scan_status=ScanStatus.OK,
            collection_source=CollectionSource.ESP32,
        ))
    return measurements


@pytest.fixture
def spatial_measurements() -> list[RSSIMeasurement]:
    """Create measurements at multiple spatial locations."""
    locations = [
        (1.0, 1.0, -45.0),
        (3.0, 1.0, -55.0),
        (5.0, 1.0, -60.0),
        (1.0, 3.0, -50.0),
        (3.0, 3.0, -58.0),
        (5.0, 3.0, -65.0),
        (1.0, 5.0, -55.0),
        (3.0, 5.0, -62.0),
        (5.0, 5.0, -70.0),
    ]
    measurements = []
    for x, y, base_rssi in locations:
        for i in range(10):
            measurements.append(RSSIMeasurement(
                timestamp_iso=f"2024-01-01T10:00:00",
                session_id="spatial_test",
                measurement_id=f"m_{x}_{y}",
                sample_index=i + 1,
                node_id="TEST_01",
                target_ssid="TestWiFi",
                bssid="AA:BB:CC:DD:EE:FF",
                channel=6,
                rssi_dbm=base_rssi + np.random.normal(0, 2),
                x_m=x,
                y_m=y,
                z_m=1.0,
                scan_status=ScanStatus.OK,
                collection_source=CollectionSource.ESP32,
            ))
    return measurements


# ═══════════════════════════════════════════════════════════════════
# Data Store Tests
# ═══════════════════════════════════════════════════════════════════
class TestDataStore:

    def test_add_measurement(self, store, sample_measurements):
        store.add_measurement(sample_measurements[0])
        assert store.total_count == 1

    def test_add_multiple(self, store, sample_measurements):
        store.add_measurements(sample_measurements)
        assert store.total_count == 10

    def test_csv_persistence(self, store, sample_measurements, temp_data_dir):
        store.add_measurements(sample_measurements)
        # Load a new store from the same directory
        store2 = DataStore(data_dir=temp_data_dir)
        assert store2.total_count == 10

    def test_get_valid_measurements(self, store):
        m1 = RSSIMeasurement(
            timestamp_iso="2024-01-01T10:00:00",
            session_id="test",
            sample_index=1,
            rssi_dbm=-50.0,
            scan_status=ScanStatus.OK,
        )
        m2 = RSSIMeasurement(
            timestamp_iso="2024-01-01T10:00:01",
            session_id="test",
            sample_index=2,
            rssi_dbm=None,
            scan_status=ScanStatus.TARGET_NOT_FOUND,
        )
        store.add_measurements([m1, m2])
        valid = store.get_valid_measurements()
        assert len(valid) == 1
        assert valid[0].rssi_dbm == -50.0

    def test_session_filtering(self, store):
        m1 = RSSIMeasurement(
            timestamp_iso="2024-01-01T10:00:00",
            session_id="session_a",
            sample_index=1,
            rssi_dbm=-50.0,
        )
        m2 = RSSIMeasurement(
            timestamp_iso="2024-01-01T10:00:01",
            session_id="session_b",
            sample_index=1,
            rssi_dbm=-60.0,
        )
        store.add_measurements([m1, m2])
        a = store.get_measurements(session_id="session_a")
        assert len(a) == 1

    def test_export_csv(self, store, sample_measurements):
        store.add_measurements(sample_measurements)
        csv_str = store.export_csv()
        reader = csv.DictReader(io.StringIO(csv_str))
        rows = list(reader)
        assert len(rows) == 10
        assert "rssi_dbm" in rows[0]

    def test_import_csv(self, store, sample_measurements):
        store.add_measurements(sample_measurements)
        csv_str = store.export_csv()
        # Create new empty store
        store2 = DataStore(data_dir=tempfile.mkdtemp())
        count = store2.import_csv(csv_str)
        assert count == 10

    def test_unique_locations(self, store, spatial_measurements):
        store.add_measurements(spatial_measurements)
        locs = store.get_unique_locations()
        assert len(locs) == 9

    def test_empty_csv(self, temp_data_dir):
        # Write an empty CSV
        path = os.path.join(temp_data_dir, "wifisense_empty.csv")
        with open(path, "w") as f:
            f.write("")
        store = DataStore(data_dir=temp_data_dir)
        assert store.total_count == 0


# ═══════════════════════════════════════════════════════════════════
# Analytics Tests
# ═══════════════════════════════════════════════════════════════════
class TestAnalytics:

    def test_location_summary_single_point(self, sample_measurements):
        summaries = AnalyticsService.compute_location_summaries(sample_measurements)
        assert len(summaries) == 1
        s = summaries[0]
        assert s.x_m == 1.0
        assert s.y_m == 2.0
        assert s.sample_count == 10
        assert s.mean_rssi is not None
        assert s.std_rssi is not None

    def test_location_summary_multiple_points(self, spatial_measurements):
        summaries = AnalyticsService.compute_location_summaries(spatial_measurements)
        assert len(summaries) == 9

    def test_summary_empty(self):
        summary = AnalyticsService.compute_summary([])
        assert summary.total_samples == 0
        assert summary.overall_mean_rssi is None

    def test_summary_with_data(self, sample_measurements):
        summary = AnalyticsService.compute_summary(sample_measurements)
        assert summary.total_samples == 10
        assert summary.valid_samples == 10
        assert summary.overall_mean_rssi is not None

    def test_stability_score(self, sample_measurements):
        summaries = AnalyticsService.compute_location_summaries(sample_measurements)
        assert summaries[0].stability_score is not None
        assert 0 <= summaries[0].stability_score <= 100

    def test_heatmap_insufficient_data(self, sample_measurements):
        summaries = AnalyticsService.compute_location_summaries(sample_measurements)
        heatmap = AnalyticsService.generate_heatmap(summaries)
        # Only 1 location — should report insufficient data
        assert not heatmap.has_sufficient_data
        assert len(heatmap.warnings) > 0

    def test_heatmap_sufficient_data(self, spatial_measurements):
        summaries = AnalyticsService.compute_location_summaries(spatial_measurements)
        heatmap = AnalyticsService.generate_heatmap(
            summaries, room_width=6.0, room_length=6.0
        )
        assert heatmap.has_sufficient_data
        assert len(heatmap.grid_rssi) > 0

    def test_heatmap_empty(self):
        heatmap = AnalyticsService.generate_heatmap([])
        assert not heatmap.has_sufficient_data

    def test_collinearity_check(self):
        collinear = np.array([[0, 0], [1, 1], [2, 2]])
        assert _are_collinear(collinear)

        non_collinear = np.array([[0, 0], [1, 0], [0, 1]])
        assert not _are_collinear(non_collinear)

    def test_loocv_sufficient_data(self, spatial_measurements):
        summaries = AnalyticsService.compute_location_summaries(spatial_measurements)
        result = AnalyticsService.evaluate_interpolation_loocv(
            summaries, room_width=6.0, room_length=6.0
        )
        assert result is not None
        assert "mae_db" in result
        assert "rmse_db" in result
        assert result["n_evaluated"] > 0

    def test_loocv_insufficient_data(self, sample_measurements):
        summaries = AnalyticsService.compute_location_summaries(sample_measurements)
        result = AnalyticsService.evaluate_interpolation_loocv(summaries)
        # Only 1 location, so should return None
        assert result is None

    def test_recommendations_no_data(self):
        recs = AnalyticsService.recommend_survey_points(
            [], room_width=8.0, room_length=6.0
        )
        assert len(recs) > 0
        assert recs[0].reason  # Should suggest starting point

    def test_recommendations_with_data(self, spatial_measurements):
        summaries = AnalyticsService.compute_location_summaries(spatial_measurements)
        recs = AnalyticsService.recommend_survey_points(
            summaries, room_width=6.0, room_length=6.0
        )
        assert len(recs) > 0


# ═══════════════════════════════════════════════════════════════════
# Simulation Tests
# ═══════════════════════════════════════════════════════════════════
class TestSimulation:

    def test_generate_room_survey(self):
        sim = SimulationService()
        measurements = sim.generate_room_survey(
            room_width=4.0,
            room_length=4.0,
            grid_spacing=2.0,
            samples_per_point=5,
        )
        assert len(measurements) > 0
        # Check all are labelled as simulation
        for m in measurements:
            assert m.collection_source == CollectionSource.SIMULATION
            assert m.scan_status == ScanStatus.SIMULATED
            assert "SYNTHETIC" in m.target_ssid

    def test_generate_single_batch(self):
        sim = SimulationService()
        measurements = sim.generate_single_batch(
            x_m=3.0, y_m=3.0, count=10
        )
        assert len(measurements) == 10
        for m in measurements:
            assert m.x_m == 3.0
            assert m.y_m == 3.0
            assert m.rssi_dbm is not None
            assert -100 <= m.rssi_dbm <= -10

    def test_synthetic_rssi_plausible(self):
        sim = SimulationService()
        measurements = sim.generate_room_survey(
            room_width=6.0,
            room_length=6.0,
            grid_spacing=1.0,
        )
        rssi_values = [m.rssi_dbm for m in measurements if m.rssi_dbm is not None]
        assert all(-100 <= v <= -10 for v in rssi_values)


# ═══════════════════════════════════════════════════════════════════
# API Tests
# ═══════════════════════════════════════════════════════════════════
class TestAPI:

    @pytest.fixture
    def client(self, temp_data_dir):
        os.environ["WIFISENSE_DATA_DIR"] = temp_data_dir
        os.environ["WIFISENSE_DEMO_DIR"] = os.path.join(temp_data_dir, "demo")

        # Need to re-import to pick up new env
        from importlib import reload
        import app.main
        reload(app.main)

        from httpx import ASGITransport, AsyncClient
        from app.main import app

        transport = ASGITransport(app=app)
        return AsyncClient(transport=transport, base_url="http://testserver")

    @pytest.mark.asyncio
    async def test_health(self, client):
        async with client as c:
            response = await c.get("/api/health")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "ok"

    @pytest.mark.asyncio
    async def test_list_ports(self, client):
        async with client as c:
            response = await c.get("/api/ports")
            assert response.status_code == 200
            # Ports list may be empty in test environment

    @pytest.mark.asyncio
    async def test_serial_status(self, client):
        async with client as c:
            response = await c.get("/api/serial/status")
            assert response.status_code == 200
            data = response.json()
            assert data["connected"] is False

    @pytest.mark.asyncio
    async def test_analytics_summary_empty(self, client):
        async with client as c:
            response = await c.get("/api/analytics/summary")
            assert response.status_code == 200
            data = response.json()
            assert data["total_samples"] == 0

    @pytest.mark.asyncio
    async def test_export_empty(self, client):
        async with client as c:
            response = await c.get("/api/data/export")
            assert response.status_code == 200
