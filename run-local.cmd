@echo off
setlocal
cd /d "%~dp0"
echo Starting Aroma Parking App...
echo.
echo Open http://127.0.0.1:3000 in your browser.
echo Press Ctrl+C in this window to stop the server.
echo.
node server.js
