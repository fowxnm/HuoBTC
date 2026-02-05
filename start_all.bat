@echo off
echo Starting BTC Exchange Services...
echo IP Address: 192.168.3.61

start "Backend Server" /d "c:\Users\AM\Desktop\BTC\backend" cmd /k "bun run start"
timeout /t 5 >nul
start "Frontend Server" /d "c:\Users\AM\Desktop\BTC\frontend" cmd /k "npm run dev"

echo Services started!
echo Access on Desktop: http://localhost:3000
echo Access on Mobile:  http://192.168.3.61:3000
pause
