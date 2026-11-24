@echo off
setlocal
chcp 65001 >nul

cd /d "%~dp0"

set "REMOTE=github"
set "BRANCH=main"
set "AHEAD=0"

echo [1/6] Checking repository...
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERROR: %~dp0 is not a Git repository.
  pause
  exit /b 1
)

if exist "%~dp0.git\rebase-merge" goto rebase_busy
if exist "%~dp0.git\rebase-apply" goto rebase_busy
goto sync

:rebase_busy
echo ERROR: A rebase is already in progress in this repository.
echo Fix the conflicts, then run:  git rebase --continue
echo Or cancel the rebase with:   git rebase --abort
pause
exit /b 1

:sync
echo [2/6] Synchronizing the redesigned homepage...
if exist "index\index.html" copy /Y "index\index.html" "index.html" >nul
if exist "index\*.html" copy /Y "index\*.html" "." >nul
if exist "index\*.jpg" copy /Y "index\*.jpg" "." >nul

echo [3/6] Saving local changes...
git add -A
if errorlevel 1 (
  echo ERROR: git add failed.
  pause
  exit /b 1
)

git diff --cached --quiet
if errorlevel 1 goto commit
echo     No local changes to commit.
goto pull

:commit
if "%~1"=="" (
  set "COMMIT_MESSAGE=Update project"
) else (
  set "COMMIT_MESSAGE=%~1"
)
echo     Commit message: "%COMMIT_MESSAGE%"
git commit -m "%COMMIT_MESSAGE%"
if errorlevel 1 (
  echo ERROR: Commit failed.
  pause
  exit /b 1
)

:pull
echo [4/6] Pulling %REMOTE%/%BRANCH%...
git pull --rebase %REMOTE% %BRANCH%
if errorlevel 1 (
  echo.
  echo ERROR: Pull / rebase failed.
  echo Your work is committed and safe. If a rebase stopped on a conflict:
  echo   fix the files, then run:  git rebase --continue
  echo   or cancel with:           git rebase --abort
  echo.
  pause
  exit /b 1
)

echo [5/6] Checking whether a push is needed...
for /f %%C in ('git rev-list --count %REMOTE%/%BRANCH%..%BRANCH%') do set "AHEAD=%%C"
if "%AHEAD%"=="0" (
  echo     Remote is already up to date. Nothing to push.
  goto done
)

echo [6/6] Pushing %BRANCH% to %REMOTE%...
git push -u %REMOTE% %BRANCH%
if errorlevel 1 (
  echo.
  echo ERROR: Push failed. Check network or GitHub authentication.
  pause
  exit /b 1
)

echo.
echo Upload complete.
echo GitHub: https://github.com/Etherealnymph/web-projects
echo Pages:  https://etherealnymph.github.io/web-projects/
pause
exit /b 0

:done
echo.
echo Already up to date. Nothing was uploaded.
echo GitHub: https://github.com/Etherealnymph/web-projects
pause
exit /b 0
