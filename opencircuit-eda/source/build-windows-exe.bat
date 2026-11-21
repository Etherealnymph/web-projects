@echo off
echo ============================================
echo   OpenCircuit EDA v2.1.0 Windows EXE Builder
echo ============================================
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [Error] Please install Node.js LTS first: https://nodejs.org/
  exit /b 1
)
echo [1/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 exit /b %errorlevel%
call npm install --save-dev electron electron-builder
if %errorlevel% neq 0 exit /b %errorlevel%
echo [2/3] Building frontend bundle...
call npm run build
if %errorlevel% neq 0 exit /b %errorlevel%
echo [3/3] Packaging Windows EXE...
call npx electron-builder --win portable nsis --config.npmRebuild=false
if %errorlevel% neq 0 exit /b %errorlevel%
echo [SUCCESS] Build completed! Output is in the "release" folder.
exit /b 0
