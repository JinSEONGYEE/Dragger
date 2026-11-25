@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js 20 or newer is required. Ask your developer to install it once.
 pause
 exit /b 1
)
node bin\launch.mjs
if errorlevel 1 pause
