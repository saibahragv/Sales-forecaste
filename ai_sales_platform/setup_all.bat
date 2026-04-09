@echo off
setlocal

REM Always run relative to this script's directory (repo root)
pushd "%~dp0"

REM One-time setup for AI Sales Platform (backend + frontend)
REM Run this from the ai_sales_platform folder.

REM Guardrail: ensure we are using 64-bit Python. 32-bit Python often forces numpy to build from source on Windows.
py -c "import struct; import sys; bits = struct.calcsize('P')*8; sys.exit(0 if bits==64 else 1)" >nul 2>nul
if errorlevel 1 (
  echo [setup][error] Detected 32-bit Python. This project requires 64-bit Python on Windows.
  echo [setup][error] Install 64-bit Python 3.10+ and re-run setup_all.bat.
  echo [setup][hint] You can check with: py -c "import struct; print(struct.calcsize('P')*8)"
  popd
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [setup] Creating venv...
  py -m venv .venv
)

echo [setup] Installing backend deps into .venv...
".venv\Scripts\python.exe" -m pip install --upgrade pip
if not exist "backend\requirements.txt" (
  echo [setup][error] Missing backend\requirements.txt. Expected at: %cd%\backend\requirements.txt
  popd
  exit /b 1
)
".venv\Scripts\python.exe" -m pip install -r backend\requirements.txt

echo [setup] Installing frontend deps...
if not exist "frontend\package.json" (
  echo [setup][error] Missing frontend\package.json. Expected at: %cd%\frontend\package.json
  popd
  exit /b 1
)
pushd frontend
npm install
popd

echo.
echo [setup] Done.
echo Next: run run_all.bat

popd
endlocal
