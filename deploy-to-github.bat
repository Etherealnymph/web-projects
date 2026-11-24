@echo off
setlocal
chcp 65001 >nul

cd /d "%~dp0"
echo [1/5] Checking repository...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERROR: %~dp0 is not a Git repository.
  pause
  exit /b 1
)

echo [2/5] Pulling github/main...
git pull --rebase github main
if errorlevel 1 (
  echo ERROR: Pull failed. Resolve conflicts, then run this script again.
  pause
  exit /b 1
)

echo [3/5] Synchronizing the redesigned homepage...
if exist "index\index.html" (
  copy /Y "index\index.html" "index.html" >nul
)
if exist "index\*.html" copy /Y "index\*.html" "." >nul
if exist "index\*.jpg" copy /Y "index\*.jpg" "." >nul

echo [4/5] Saving all changes...
git add -A
git diff --cached --quiet
if not errorlevel 1 (
  echo.
  echo Nothing changed. No commit or push is needed.
  echo.
  pause
  exit /b 0
)

if not "%~1"=="" (
  set "COMMIT_MESSAGE=%~1"
) else (
  set "COMMIT_MESSAGE=Update project"
)
git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 (
  echo ERROR: Commit failed.
  pause
  exit /b 1
)

echo [5/5] Pushing github/main...
git push -u github main
if errorlevel 1 (
  echo ERROR: Push failed. Check network or GitHub authentication.
  pause
  exit /b 1
)

echo.
echo Upload complete.
echo GitHub: https://github.com/Etherealnymph/web-projects
echo Pages:  https://etherealnymph.github.io/web-projects/
pause
endlocal
