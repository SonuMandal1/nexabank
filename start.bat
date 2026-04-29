@echo off
echo.
echo  NexaBank - Starting Server
echo.
cd /d "%~dp0backend"
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js not found. Install from https://nodejs.org
  pause
  exit /b
)
if not exist "node_modules" (
  echo Installing dependencies...
  npm install
)
echo Starting NexaBank on http://localhost:5000
echo Admin: admin@nexabank.com / admin123
echo.
npm start
pause
