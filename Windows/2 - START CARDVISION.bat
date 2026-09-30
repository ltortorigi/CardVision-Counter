@echo off
setlocal
set "ROOT=%~dp0.."
set "APPDIR=%ROOT%\App"
set "NODEURL=https://nodejs.org/en/download"

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo CardVision needs Node.js 20 or newer.
    echo Opening the official Node.js download page...
    start "" "%NODEURL%"
    echo.
    echo Install the LTS version of Node.js, then run:
    echo   1 - SETUP CARDVISION.bat
    echo again.
    pause
    exit /b 1
)

for /f %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODEMAJOR=%%V"
if %NODEMAJOR% LSS 20 (
    echo.
    echo Your Node.js version is too old. CardVision needs Node.js 20 or newer.
    echo Opening the official Node.js download page...
    start "" "%NODEURL%"
    pause
    exit /b 1
)

cd /d "%APPDIR%"

if not exist "node_modules" (
    echo Installing CardVision files for first use...
    call npm ci
    if errorlevel 1 (
        echo.
        echo npm ci failed. Check your internet connection and try again.
        pause
        exit /b 1
    )
)

call npm start
