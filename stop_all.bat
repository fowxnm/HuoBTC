@echo off
echo Stopping Services...
taskkill /F /IM node.exe
taskkill /F /IM bun.exe
echo Stopped.
pause
