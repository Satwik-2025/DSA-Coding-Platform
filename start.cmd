@echo off
rem Starts the whole site on Windows: double-click this file, or run  start.cmd  in a terminal.
rem It runs start.ps1 with a one-time policy bypass, so it also works for files from a downloaded zip.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
echo.
pause
