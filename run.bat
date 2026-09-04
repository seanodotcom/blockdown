@echo off
title BLOCKDOWN - 3D Retro Puzzle
echo Starting Blockdown...
node server.js
if errorlevel 1 (
    echo Node.js not found or error occurred, falling back to Python...
    start http://localhost:8080
    python -m http.server 8080
)
pause
