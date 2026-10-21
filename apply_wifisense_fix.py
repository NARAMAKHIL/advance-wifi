#!/usr/bin/env python3
"""
WiFiSense 3D: Apply live hardware fix, verify components, and build static distribution.

Usage:
    python apply_wifisense_fix.py [optional_path_to_repo]
"""
import sys
from pathlib import Path
import subprocess

def main():
    root = Path(__file__).resolve().parent
    script = root / "scripts" / "apply_wifisense_fix.py"
    if not script.exists():
        print(f"Error: {script} not found.", file=sys.stderr)
        sys.exit(1)
    args = [sys.executable, str(script)] + sys.argv[1:]
    sys.exit(subprocess.call(args))

if __name__ == "__main__":
    main()
