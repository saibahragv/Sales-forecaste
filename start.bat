@echo off
title AI Sales Platform - Auto Launcher

echo Starting AI Sales Platform...
echo.

REM Change to script directory
cd /d "%~dp0"

REM Run the Python launcher
python start.py

pause
