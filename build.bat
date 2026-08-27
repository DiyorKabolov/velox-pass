@echo off
REM Velox Pass - builds the React frontend into frontend\dist so that
REM backend\main.py can serve the whole site from port 8000.

cd /d "%~dp0"

echo Building frontend...
cd frontend

if not exist "node_modules" (
    echo [!] node_modules not found. Running npm install first...
    call npm install
    if errorlevel 1 goto failed
)

call npm run build
if errorlevel 1 goto failed

cd ..
echo.
echo Frontend built successfully!
echo Run "python backend/main.py" to start the server.
echo.
exit /b 0

:failed
cd /d "%~dp0"
echo.
echo [!] BUILD FAILED - dist was not updated. Scroll up for the error.
echo.
pause
exit /b 1
