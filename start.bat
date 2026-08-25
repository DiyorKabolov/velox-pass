@echo off
REM Velox Pass - starts the backend and the frontend in two separate windows.
REM Close a window (or press Ctrl+C in it) to stop that half.

cd /d "%~dp0"

if not exist "backend\main.py" (
    echo [!] backend\main.py not found - run start.bat from the project root.
    pause
    exit /b 1
)
if not exist "frontend\node_modules" (
    echo [!] frontend\node_modules not found.
    echo     Run "npm install" inside the frontend folder first.
    pause
    exit /b 1
)

echo Starting Velox Pass...
echo    backend  -^> http://localhost:8000
echo    frontend -^> http://localhost:5173
echo.

start "Velox Pass - backend" cmd /k "cd backend && python main.py"
start "Velox Pass - frontend" cmd /k "cd frontend && npm run dev"

echo Two windows opened. Open http://localhost:5173 in the browser.
timeout /t 3 >nul
