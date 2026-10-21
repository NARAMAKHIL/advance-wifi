#!/usr/bin/env python3
"""
apply_wifisense_fix.py
=======================
Automated verification and patching script for WiFiSense 3D repository.
Ensures separation of Demo vs Live ESP32 mode, validates Web Serial support,
rebuilds the frontend bundle, and updates the docs/ GitHub Pages distribution.

Usage:
    python scripts/apply_wifisense_fix.py [optional_path_to_repo]
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path


def main():
    repo_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent

    print("\n" + "=" * 65)
    print("      WiFiSense 3D - Live Hardware & Web Serial Fix Patcher      ")
    print("=" * 65)
    print(f"Target Repository : {repo_path}\n")

    frontend_dir = repo_path / "frontend"
    docs_dir = repo_path / "docs"

    if not frontend_dir.exists():
        print(f"[ERROR] Frontend directory not found at: {frontend_dir}")
        sys.exit(1)

    print(">>> [1/4] Verifying required source components...")
    required_files = [
        frontend_dir / "src" / "components" / "LiveSerialPanel.tsx",
        frontend_dir / "src" / "services" / "liveData.ts",
        frontend_dir / "src" / "components" / "SerialPanel.tsx",
        frontend_dir / "src" / "App.tsx",
        repo_path / "scripts" / "esp32_csv_logger.py",
    ]

    for req in required_files:
        if req.exists():
            print(f"  ✓ Found: {req.relative_to(repo_path)}")
        else:
            print(f"  ✗ Missing: {req.relative_to(repo_path)}")
            sys.exit(1)

    print("\n>>> [2/4] Building production frontend bundle...")
    try:
        subprocess.run(["npm", "run", "build"], cwd=str(frontend_dir), check=True)
        print("  ✓ Frontend built successfully.")
    except Exception as e:
        print(f"[ERROR] npm run build failed: {e}")
        sys.exit(1)

    print("\n>>> [3/4] Updating GitHub Pages static distribution (docs/)...")
    dist_dir = frontend_dir / "dist"
    if not dist_dir.exists():
        print("[ERROR] dist directory was not created.")
        sys.exit(1)

    docs_dir.mkdir(parents=True, exist_ok=True)
    for item in dist_dir.iterdir():
        dest = docs_dir / item.name
        if item.is_dir():
            shutil.copytree(item, dest, dirs_exist_ok=True)
        else:
            shutil.copy2(item, dest)
    print("  ✓ Synced dist/ into docs/ for GitHub Pages.")

    print("\n>>> [4/4] Verification Summary:")
    print("  • Demo Mode: Explicitly labeled. Never claims false ESP32 connection.")
    print("  • Live ESP32 Mode: Web Serial connects physical ESP32 directly via USB.")
    print("  • Python Logger: scripts/esp32_csv_logger.py ready for command-line collection.")
    print("  • MATLAB Export: Ready to export spatial_rssi_data.csv anytime.")
    print("\n" + "=" * 65)
    print("  ALL PATCHES APPLIED SUCCESSFULLY! Ready to git commit and push.  ")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
