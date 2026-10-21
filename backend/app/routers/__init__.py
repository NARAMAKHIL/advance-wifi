"""
WiFiSense 3D - API Routers
============================
All REST and WebSocket endpoints for the backend.
"""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from typing import Optional

from fastapi import APIRouter, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import PlainTextResponse

from app.models import (
    AnalyticsSummary,
    CollectionSource,
    HealthResponse,
    HeatmapData,
    LocationSummary,
    PortInfo,
    SerialConfig,
    SerialStatus,
    SessionInfo,
    StartMeasurementRequest,
    SurveyRecommendation,
)

api_router = APIRouter()


# ─── Helpers to get shared services ──────────────────────────────
def _store():
    from app.main import data_store
    return data_store

def _serial():
    from app.main import serial_manager
    return serial_manager

def _analytics():
    from app.main import analytics_service
    return analytics_service

def _simulation():
    from app.main import simulation_service
    return simulation_service

def _start_time():
    from app.main import get_start_time
    return get_start_time()


# ═══════════════════════════════════════════════════════════════════
# Health
# ═══════════════════════════════════════════════════════════════════
@api_router.get("/health", response_model=HealthResponse)
async def health():
    serial_status = _serial().get_status()
    return HealthResponse(
        status="ok",
        version="1.0.0",
        uptime_seconds=round(time.time() - _start_time(), 1),
        serial_connected=serial_status.connected,
        data_points=_store().total_count,
    )


# ═══════════════════════════════════════════════════════════════════
# Serial / Device Management
# ═══════════════════════════════════════════════════════════════════
@api_router.get("/ports", response_model=list[PortInfo])
async def list_ports():
    return _serial().list_ports()


@api_router.get("/serial/status", response_model=SerialStatus)
async def serial_status():
    return _serial().get_status()


@api_router.post("/serial/connect", response_model=SerialStatus)
async def serial_connect(config: SerialConfig):
    success = _serial().connect(config.port, config.baud_rate)
    if not success:
        raise HTTPException(
            status_code=400,
            detail=f"Failed to connect to {config.port}. Check that the port exists and is not in use.",
        )
    return _serial().get_status()


@api_router.post("/serial/disconnect", response_model=SerialStatus)
async def serial_disconnect():
    _serial().disconnect()
    return _serial().get_status()


@api_router.post("/serial/scan")
async def serial_scan():
    success = _serial().scan_networks()
    if not success:
        raise HTTPException(status_code=400, detail="Cannot scan: serial not connected")
    return {"status": "scan_command_sent"}


@api_router.get("/serial/events")
async def serial_events(since: int = Query(0, ge=0)):
    return _serial().get_events(since=since)


# ═══════════════════════════════════════════════════════════════════
# Measurements
# ═══════════════════════════════════════════════════════════════════
@api_router.post("/measurements/start")
async def start_measurement(request: StartMeasurementRequest):
    session_id = request.session_id or str(uuid.uuid4())[:8]
    measurement_id = str(uuid.uuid4())[:8]

    success = _serial().start_measurement(
        target_ssid=request.target_ssid,
        target_bssid=request.target_bssid,
        x_m=request.x_m,
        y_m=request.y_m,
        z_m=request.z_m,
        count=request.count,
        interval_ms=request.interval_ms,
        session_id=session_id,
        measurement_id=measurement_id,
    )

    if not success:
        raise HTTPException(
            status_code=400,
            detail="Cannot start measurement. Check serial connection and that no measurement is already running.",
        )

    return {
        "status": "measurement_started",
        "session_id": session_id,
        "measurement_id": measurement_id,
    }


@api_router.post("/measurements/stop")
async def stop_measurement():
    success = _serial().stop_measurement()
    if not success:
        raise HTTPException(status_code=400, detail="Cannot stop: no active measurement or serial not connected")
    return {"status": "stop_command_sent"}


@api_router.get("/measurements")
async def get_measurements(
    session_id: Optional[str] = None,
    limit: int = Query(500, ge=1, le=10000),
):
    measurements = _store().get_measurements(session_id=session_id)
    # Return most recent first
    return [m.model_dump() for m in measurements[-limit:]]


# ═══════════════════════════════════════════════════════════════════
# Sessions
# ═══════════════════════════════════════════════════════════════════
@api_router.get("/sessions", response_model=list[SessionInfo])
async def get_sessions():
    return _store().get_sessions()


# ═══════════════════════════════════════════════════════════════════
# Analytics
# ═══════════════════════════════════════════════════════════════════
@api_router.get("/analytics/summary", response_model=AnalyticsSummary)
async def analytics_summary(session_id: Optional[str] = None):
    measurements = _store().get_valid_measurements(session_id=session_id)
    return _analytics().compute_summary(measurements)


@api_router.get("/analytics/locations", response_model=list[LocationSummary])
async def analytics_locations(session_id: Optional[str] = None):
    measurements = _store().get_valid_measurements(session_id=session_id)
    return _analytics().compute_location_summaries(measurements)


@api_router.get("/analytics/heatmap", response_model=HeatmapData)
async def analytics_heatmap(
    session_id: Optional[str] = None,
    room_width: float = Query(10.0, gt=0),
    room_length: float = Query(10.0, gt=0),
    method: str = Query("linear"),
    resolution: int = Query(30, ge=10, le=100),
):
    measurements = _store().get_valid_measurements(session_id=session_id)
    summaries = _analytics().compute_location_summaries(measurements)
    return _analytics().generate_heatmap(
        summaries=summaries,
        room_width=room_width,
        room_length=room_length,
        grid_resolution=resolution,
        method=method,
    )


@api_router.get("/analytics/recommendations", response_model=list[SurveyRecommendation])
async def analytics_recommendations(
    session_id: Optional[str] = None,
    room_width: float = Query(10.0, gt=0),
    room_length: float = Query(10.0, gt=0),
    grid_spacing: float = Query(1.0, gt=0),
    max_results: int = Query(5, ge=1, le=20),
):
    measurements = _store().get_valid_measurements(session_id=session_id)
    summaries = _analytics().compute_location_summaries(measurements)
    return _analytics().recommend_survey_points(
        summaries=summaries,
        room_width=room_width,
        room_length=room_length,
        grid_spacing=grid_spacing,
        max_recommendations=max_results,
    )


@api_router.get("/analytics/validation")
async def analytics_validation(
    session_id: Optional[str] = None,
    room_width: float = Query(10.0, gt=0),
    room_length: float = Query(10.0, gt=0),
):
    measurements = _store().get_valid_measurements(session_id=session_id)
    summaries = _analytics().compute_location_summaries(measurements)
    result = _analytics().evaluate_interpolation_loocv(
        summaries=summaries,
        room_width=room_width,
        room_length=room_length,
    )
    if result is None:
        return {
            "status": "insufficient_data",
            "message": "Need at least 4 non-collinear measurement locations for cross-validation.",
            "locations_available": len(summaries),
        }
    return result


# ═══════════════════════════════════════════════════════════════════
# Data Management
# ═══════════════════════════════════════════════════════════════════
@api_router.get("/data/export")
async def export_data(session_id: Optional[str] = None):
    csv_content = _store().export_csv(session_id=session_id)
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=wifisense_export.csv"},
    )


@api_router.post("/data/import")
async def import_data(file: UploadFile = File(...)):
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    csv_str = content.decode("utf-8", errors="replace")
    count = _store().import_csv(csv_str, source=CollectionSource.IMPORTED)

    return {
        "status": "imported",
        "rows_imported": count,
        "filename": file.filename,
    }


@api_router.delete("/data/session/{session_id}")
async def delete_session(session_id: str):
    removed = _store().clear_session(session_id)
    return {"status": "deleted", "rows_removed": removed}


# ═══════════════════════════════════════════════════════════════════
# Simulation
# ═══════════════════════════════════════════════════════════════════
@api_router.post("/simulation/generate")
async def generate_simulation(
    room_width: float = Query(8.0, gt=0),
    room_length: float = Query(6.0, gt=0),
    grid_spacing: float = Query(1.0, gt=0),
    samples_per_point: int = Query(10, ge=1, le=50),
):
    """
    Generate synthetic demonstration data.
    This data is clearly labelled as SIMULATED and stored separately.
    """
    measurements = _simulation().generate_room_survey(
        room_width=room_width,
        room_length=room_length,
        grid_spacing=grid_spacing,
        samples_per_point=samples_per_point,
    )

    # Store in a separate demo data store
    demo_store = _get_demo_store()
    demo_store.add_measurements(measurements)

    # Also add to main store (labelled as simulation)
    _store().add_measurements(measurements)

    return {
        "status": "generated",
        "data_points": len(measurements),
        "locations": len(set((m.x_m, m.y_m) for m in measurements)),
        "session_id": measurements[0].session_id if measurements else "",
        "warning": "⚠ SYNTHETIC DEMO DATA — not real measurements",
    }


def _get_demo_store():
    """Get or create the demo data store."""
    from app.services.data_store import DataStore
    import os
    demo_dir = os.environ.get("WIFISENSE_DEMO_DIR", "data/synthetic_demo")
    return DataStore(data_dir=demo_dir)


# ═══════════════════════════════════════════════════════════════════
# WebSocket for live updates
# ═══════════════════════════════════════════════════════════════════
@api_router.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    await websocket.accept()
    last_index = 0

    try:
        while True:
            events = _serial().get_events(since=last_index)
            for event in events:
                await websocket.send_json(event)
                last_index = event.get("_index", last_index) + 1

            # Also send data stats periodically
            await asyncio.sleep(0.5)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
