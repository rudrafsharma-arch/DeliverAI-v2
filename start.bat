@echo off
echo Starting DeliverAI v2...

REM Kill existing processes
taskkill /f /im node.exe 2>nul
timeout /t 2 /nobreak >nul

REM Start server
start "DeliverAI Server" cmd /k "cd /d C:\Users\vikram.f.sharma\DeliverAI-v2 && node server/index.js"
timeout /t 3 /nobreak >nul

REM Start client
start "DeliverAI Client" cmd /k "cd /d C:\Users\vikram.f.sharma\DeliverAI-v2\client && npm start"

echo DeliverAI v2 starting...
echo Server: http://localhost:3005
echo Client: http://localhost:3000