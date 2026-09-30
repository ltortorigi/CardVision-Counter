@echo off
setlocal
set "ROOT=%~dp0.."
set "APPDIR=%ROOT%\App"
set "NODEURL=https://nodejs.org/en/download"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js 20+ is required to build CardVision.
    start "" "%NODEURL%"
    pause
    exit /b 1
)

cd /d "%APPDIR%"
if not exist node_modules (
  call npm ci
  if errorlevel 1 exit /b 1
)
call npx electron-builder --win portable
if errorlevel 1 exit /b 1
echo.
echo Build output is in:
echo   %ROOT%\Build Output
pause
