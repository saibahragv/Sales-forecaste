#!/usr/bin/env python3
"""
AI Sales Platform - Auto Launcher
Starts backend + frontend and opens web pages automatically
"""

import os
import sys
import subprocess
import time
import webbrowser
from pathlib import Path

def check_requirements():
    """Check if required tools are available"""
    print("Checking requirements...")
    
    # Check Python
    python_version = sys.version_info
    print(f"Python {python_version.major}.{python_version.minor}.{python_version.micro}")
    
    # Check Node.js
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        print(f"Node.js {result.stdout.strip()}")
    except FileNotFoundError:
        print("Node.js not found. Please install Node.js 18+")
        return False
    
    # Check virtual environment
    venv_python = Path("ai_sales_platform/.venv/Scripts/python.exe")
    if not venv_python.exists():
        print("Virtual environment not found. Creating...")
        try:
            subprocess.run([sys.executable, "-m", "venv", "ai_sales_platform/.venv"], check=True)
            print("Virtual environment created")
        except Exception as e:
            print(f"Error creating virtual environment: {e}")
            return False
    
    return True

def install_dependencies():
    """Install required dependencies"""
    print("\nInstalling dependencies...")
    
    # Backend dependencies
    print("Installing backend dependencies...")
    venv_python = "ai_sales_platform/.venv/Scripts/python.exe"
    subprocess.run([venv_python, "-m", "pip", "install", "--upgrade", "pip"], check=True)
    
    # Install basic requirements first
    basic_packages = ["fastapi", "uvicorn", "pydantic", "numpy", "pandas", "lightgbm", "shap", "joblib", "requests"]
    for package in basic_packages:
        print(f"Installing {package}...")
        subprocess.run([venv_python, "-m", "pip", "install", package], check=True)
    
    # Frontend dependencies
    print("Installing frontend dependencies...")
    if not Path("ai_sales_platform/frontend/node_modules").exists():
        subprocess.run(["npm", "install"], cwd="ai_sales_platform/frontend", check=True)
    
    print("Dependencies installed")

def start_backend():
    """Start the FastAPI backend"""
    print("\nStarting backend...")
    # Use absolute path for the venv python to avoid confusion
    root_dir = Path(__file__).parent.absolute()
    venv_python = str(root_dir / "ai_sales_platform" / ".venv" / "Scripts" / "python.exe")
    
    if not os.path.exists(venv_python):
        print(f"Error: Backend python not found at {venv_python}")
        return None

    # Start backend in background
    backend_process = subprocess.Popen(
        [venv_python, "main.py"],
        cwd=str(root_dir / "ai_sales_platform" / "backend"),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    print(f"Backend started (PID: {backend_process.pid})")
    return backend_process

def start_frontend():
    """Start the React frontend"""
    print("\nStarting frontend...")
    root_dir = Path(__file__).parent.absolute()
    
    # Start frontend in background using shell=True for npm on Windows
    frontend_process = subprocess.Popen(
        ["npm.cmd", "run", "dev"],
        cwd=str(root_dir / "ai_sales_platform" / "frontend"),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=True,
        text=True
    )
    
    print(f"Frontend started (PID: {frontend_process.pid})")
    return frontend_process

def wait_for_services():
    """Wait for services to be ready"""
    print("\nWaiting for services to start...")
    
    import requests
    import urllib3
    
    # Disable SSL warnings
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    # Wait for backend
    backend_ready = False
    for i in range(30):  # Wait up to 30 seconds
        try:
            response = requests.get("http://localhost:8000/docs", timeout=2)
            if response.status_code == 200:
                backend_ready = True
                print("Backend is ready")
                break
        except:
            pass
        time.sleep(1)
        print(f"Waiting for backend... ({i+1}/30)")
    
    if not backend_ready:
        print("Backend may not be ready, but continuing...")
    
    # Wait a bit more for frontend
    time.sleep(3)
    print("Frontend should be ready")

def open_browsers():
    """Open web browsers"""
    print("\nOpening web pages...")
    
    # Open backend API docs
    webbrowser.open("http://localhost:8000/docs")
    print("Backend API docs opened: http://localhost:8000/docs")
    
    # Open frontend UI
    webbrowser.open("http://localhost:5173")
    print("Frontend UI opened: http://localhost:5173")

def main():
    """Main launcher function"""
    print("=" * 60)
    print("AI Sales Platform - Auto Launcher")
    print("=" * 60)
    
    # Change to script directory
    script_dir = Path(__file__).parent
    os.chdir(script_dir)
    print(f"Working directory: {script_dir}")
    
    try:
        # Check requirements
        if not check_requirements():
            input("Press Enter to exit...")
            return
        
        # Install dependencies if needed
        if not Path("ai_sales_platform/frontend/node_modules").exists():
            install_dependencies()
        
        # Start services
        backend_process = start_backend()
        frontend_process = start_frontend()
        
        # Wait for services to be ready
        wait_for_services()
        
        # Open browsers
        open_browsers()
        
        print("\n" + "=" * 60)
        print("AI Sales Platform is running!")
        print("=" * 60)
        print("Backend API: http://localhost:8000/docs")
        print("Frontend UI: http://localhost:5173")
        print("Hierarchy: http://localhost:8000/hierarchy")
        print("=" * 60)
        print("Press Ctrl+C to stop all services")
        print("=" * 60)
        
        # Keep running until user stops it
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n\nStopping services...")
            backend_process.terminate()
            frontend_process.terminate()
            print("All services stopped")
            
    except Exception as e:
        print(f"\nError: {e}")
        input("Press Enter to exit...")

if __name__ == "__main__":
    main()
