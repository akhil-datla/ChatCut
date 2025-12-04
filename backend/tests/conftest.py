"""Test configuration and shared fixtures for backend test suite."""
from __future__ import annotations

import sys
from pathlib import Path

# Ensure the backend package root is importable without per-test sys.path hacks.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
