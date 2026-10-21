"""
WiFiSense 3D - FastAPI Main Application
=========================================
Entry point for the backend API server.
Serves REST endpoints and WebSocket connections for real-time updates.
"""
from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import api_router
from app.services.data_store import DataStore
from app.services.serial_manager import SerialManager
from app.services.analytics import AnalyticsService
from app.services.simulation import SimulationService

# ─── Globals ──────────────────────────────────────────────────────
START_TIME = time.time()

# Data directory - relative to project root
DATA_DIR = os.environ.get("WIFISENSE_DATA_DIR", "data/real")
DEMO_DIR = os.environ.get("WIFISENSE_DEMO_DIR", "data/synthetic_demo")

# Shared service instances
data_store = DataStore(data_dir=DATA_DIR)
serial_manager = SerialManager()
analytics_service = AnalyticsService()
simulation_service = SimulationService()


def get_start_time() -> float:
    return START_TIME


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifecycle management."""
    # Startup
    print("╔════════════════════════════════════════════╗")
    print("║      WiFiSense 3D - Backend Starting      ║")
    print("╚════════════════════════════════════════════╝")
    print(f"  Data directory: {DATA_DIR}")
    print(f"  Loaded {data_store.total_count} existing measurements")
    print(f"  Valid measurements: {data_store.valid_count}")

    # Wire up serial callbacks to data store
    serial_manager.set_callbacks(
        on_measurement=lambda m: data_store.add_measurement(m),
    )

    yield

    # Shutdown - clean up serial connection
    print("\nShutting down...")
    serial_manager.disconnect()
    print("Serial disconnected. Goodbye.")


# ─── App Creation ─────────────────────────────────────────────────
app = FastAPI(
    title="WiFiSense 3D",
    description="Intelligent Wi-Fi Coverage Mapping and Signal Analytics API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API router
app.include_router(api_router, prefix="/api")

# Serve frontend static files if they exist
frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
