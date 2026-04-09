@echo off
setlocal

REM Always run relative to this script's directory (repo root)
pushd "%~dp0"

set "ROOT=%CD%"

REM Starts backend + frontend in 2 separate windows
REM Run this from the ai_sales_platform folder.

if not exist ".venv\Scripts\python.exe" (
  echo [run] Missing venv. Run setup_all.bat first.
  popd
  exit /b 1
)

if not exist "backend\main.py" (
  echo [run][error] Missing backend\main.py. Current dir: %ROOT%
  popd
  exit /b 1
)

if not exist "frontend\package.json" (
  echo [run][error] Missing frontend\package.json. Current dir: %ROOT%
  popd
  exit /b 1
)

if not exist "%ROOT%\.venv\Scripts\python.exe" (
  echo [run][error] Missing %ROOT%\.venv\Scripts\python.exe. Run setup_all.bat first.
  popd
  exit /b 1
)

start "Backend (FastAPI)" /D "%ROOT%\backend" cmd /k ""%ROOT%\.venv\Scripts\python.exe" main.py"
start "Frontend (Vite)" /D "%ROOT%\frontend" cmd /k "npm run dev"

echo.
echo Backend:  http://localhost:8000/docs
echo Frontend: http://localhost:5173
echo.
echo If filters are empty, open: http://localhost:8000/hierarchy

popd
endlocal
