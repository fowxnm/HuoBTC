@echo off
chcp 65001 >nul
REM ============================================================
REM BTC Exchange - Windows 本地部署一键启动
REM 前置：本机已安装 PostgreSQL、Redis、Bun，并配置好 backend\.env
REM ============================================================

cd /d "%~dp0"

echo.
echo ╔══════════════════════════════════════════════════════════════╗
echo ║           BTC Exchange - Windows 本地启动                   ║
echo ╚══════════════════════════════════════════════════════════════╝
echo.

if not exist "backend\.env" (
    echo [提示] 未找到 backend\.env，正在从 .env.example 复制...
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env" >nul
        echo [提示] 已创建 backend\.env，请确认 DATABASE_URL 与 REDIS_URL 指向本机后再启动。
        echo        默认：postgres://postgres:password@localhost:5432/btc_exchange
        echo        REDIS_URL=redis://localhost:6379
        echo.
    )
)

echo [1/2] 启动后端 (端口 8000)...
start "BTC Backend" cmd /k "cd /d "%~dp0backend" && bun run dev"

timeout /t 3 /nobreak >nul

echo [2/2] 启动前端 (端口 3000)...
start "BTC Frontend" cmd /k "cd /d "%~dp0frontend" && bun run dev"

echo.
echo 后端日志与前端日志已在两个窗口中输出。
echo 浏览器访问: http://localhost:3000
echo.
pause
