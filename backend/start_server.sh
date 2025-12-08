#!/bin/bash
# Quick script to start the backend server

cd "$(dirname "$0")"
source venv/bin/activate
echo "Starting ChatCut Backend Server..."
echo "Server will run on http://127.0.0.1:3001"
echo "Auto-reload enabled - changes will be picked up automatically"
echo "Press Ctrl+C to stop"
echo ""
uvicorn main:app --host 127.0.0.1 --port 3001 --reload

