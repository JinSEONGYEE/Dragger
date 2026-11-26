@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Node.js 20 or newer is required. Install it from https://nodejs.org/en/download then reopen this file. See README.md for AI-assisted setup.
 pause
 exit /b 1
)
node bin\launch.mjs
if errorlevel 1 pause
