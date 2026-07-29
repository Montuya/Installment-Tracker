@echo off
title Installment Tracker - JEZZ APPLIANCES
cd /d "%~dp0"
echo.
echo ============================================
echo   Installment Tracker - JEZZ APPLIANCES
echo ============================================
echo.
echo Stopping any existing server on port 3000...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo.
echo Starting server using portable Node.js...
echo.
start "" "http://localhost:3000"
"%~dp0node\node.exe" server.js
pause
