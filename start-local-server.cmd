@echo off
setlocal
cd /d "%~dp0"

echo Starting the current local portfolio build...
echo The browser opens after the server confirms it is ready.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js LTS, then run this file again.
  echo.
  pause
  exit /b 1
)

if not defined OPEN_BROWSER set "OPEN_BROWSER=1"
node scripts\serve.mjs
set "SERVER_EXIT=%ERRORLEVEL%"

if not "%SERVER_EXIT%"=="0" (
  echo.
  echo The local server did not start. See the message above for the cause.
  pause
)
exit /b %SERVER_EXIT%
