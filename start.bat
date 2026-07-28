@echo off
title Installment Tracker - Appliance Store
cd /d "%~dp0"
echo.
echo ============================================
echo   Installment Tracker - Appliance Store
echo ============================================
echo.
echo Starting server using portable Node.js...
echo.
start "" "http://localhost:3000"
"%~dp0node\node.exe" server.js
pause
