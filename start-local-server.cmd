@echo off
setlocal
cd /d "%~dp0"

echo.
echo Local portfolio server is running at:
echo   http://127.0.0.1:4173/
echo.
echo Keep this window open while using the site.
echo Press Ctrl+C to stop the server.
echo.

set "OPEN_BROWSER=1"
node scripts\serve.mjs
