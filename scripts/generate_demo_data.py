#!/usr/bin/env python3
"""
Generate realistic synthetic demonstration survey dataset for WiFiSense 3D.
Useful for offline testing, MATLAB algorithm evaluation, and UI demonstration.
"""
from pathlib import Path
import sys

# Add backend to python path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root / "backend"))

from app.services.simulation import SimulationService
from app.services.data_store import DataStore

def main():
    sim = SimulationService()
    print("Generating physics-based synthetic Wi-Fi survey data...")
    measurements = sim.generate_room_survey(
        room_width=8.0,
        room_length=6.0,
        grid_spacing=1.0,
        samples_per_point=10,
    )
    print(f"Generated {len(measurements)} samples across unique locations.")

    # Save to data/synthetic_demo/
    demo_dir = project_root / "data" / "synthetic_demo"
    demo_store = DataStore(data_dir=str(demo_dir))
    demo_store.add_measurements(measurements)
    csv_content = demo_store.export_csv()

    demo_csv = demo_dir / "measurements.csv"
    with open(demo_csv, "w") as f:
        f.write(csv_content)
    print(f"Saved demo dataset to {demo_csv}")

    # Also make a copy in matlab/ for direct MATLAB access
    matlab_csv = project_root / "matlab" / "sample_measurements.csv"
    with open(matlab_csv, "w") as dst:
        dst.write(csv_content)
    print(f"Saved copy to {matlab_csv}")

if __name__ == "__main__":
    main()
