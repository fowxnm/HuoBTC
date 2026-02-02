@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ═══════════════════════════════════════════
echo   BTC 克隆后一键配置：复制 .env + 安装依赖
echo ═══════════════════════════════════════════
echo.

REM 后端 .env
if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env" >nul
    echo [√] backend\.env 已从 .env.example 创建
) else (
    echo [·] backend\.env 已存在，跳过
)

REM 前端 .env
if not exist "frontend\.env" (
    copy "frontend\.env.example" "frontend\.env" >nul
    echo [√] frontend\.env 已从 .env.example 创建
) else (
    echo [·] frontend\.env 已存在，跳过
)

echo.
echo [1/2] 安装后端依赖...
cd backend
call bun install
cd ..
echo.

echo [2/2] 安装前端依赖...
cd frontend
call bun install
cd ..
echo.

echo ═══════════════════════════════════════════
echo   配置完成。请编辑 backend\.env 填写：
echo   DATABASE_URL、REDIS_URL
echo   然后运行 start-windows.bat 启动。
echo ═══════════════════════════════════════════
echo.
pause
