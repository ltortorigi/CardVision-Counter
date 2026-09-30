@echo off
setlocal
set "ROOT=%~dp0.."
set "APPDIR=%ROOT%\App"
set "NODEURL=https://nodejs.org/en/download"

echo =====================================================
echo              CARDVISION WINDOWS SETUP
echo =====================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed.
    echo.
    echo CardVision needs Node.js 20 or newer.
    echo The official Node.js download page will open now.
    echo Install the LTS version, then run this setup again.
    echo.
    start "" "%NODEURL%"
    pause
    exit /b 1
)

for /f %%V in ('node -p "process.versions.node.split('.')[0]"') do set "NODEMAJOR=%%V"
if %NODEMAJOR% LSS 20 (
    echo Your Node.js version is too old.
    echo CardVision needs Node.js 20 or newer.
    start "" "%NODEURL%"
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo npm was not found. Reinstall Node.js LTS from:
    echo %NODEURL%
    start "" "%NODEURL%"
    pause
    exit /b 1
)

echo Node.js detected.
echo.
cd /d "%APPDIR%"

if not exist "node_modules" (
    echo Installing CardVision dependencies...
    echo This is normally only needed once.
    call npm install
    if errorlevel 1 (
        echo.
        echo Installation failed.
        echo Check your internet connection and try again.
        pause
        exit /b 1
    )
) else (
    echo CardVision dependencies are already installed.
)

echo.
echo Creating the black/gold CardVision poker-chip shortcut...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Create CardVision Shortcut.ps1"
if errorlevel 1 (
    echo.
    echo Shortcut creation failed.
    echo You can still start CardVision with:
    echo   2 - START CARDVISION.bat
    pause
    exit /b 1
)

echo.
echo =====================================================
echo                 SETUP COMPLETE
echo =====================================================
echo.
echo Look on your DESKTOP for:
echo.
echo       CardVision Counter
echo.
echo It will have the BLACK / GOLD poker-chip icon.
echo Double-click that icon whenever you want to start the app.
echo.
echo Backup launcher:
echo   Windows\2 - START CARDVISION.bat
echo.
pause
