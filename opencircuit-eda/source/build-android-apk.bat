@echo off
echo ============================================
echo   OpenCircuit EDA v2.1.0 Android APK Builder
echo ============================================
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [Error] Please install Node.js LTS first.
  exit /b 1
)
call npm install
if %errorlevel% neq 0 exit /b %errorlevel%
call npm install @capacitor/core @capacitor/cli @capacitor/android
if %errorlevel% neq 0 exit /b %errorlevel%
call npm run build
if %errorlevel% neq 0 exit /b %errorlevel%
if not exist "android" (
  call npx cap add android
)
call npx cap sync android
cd android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 exit /b %errorlevel%
echo [SUCCESS] Android APK built at android\app\build\outputs\apk\debug\app-debug.apk
exit /b 0
