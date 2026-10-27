@echo off
setlocal
cd /d "%~dp0"
set "TWIN_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not exist "%TWIN_PYTHON%" set "TWIN_PYTHON=python"
start "HARBOR TWIN" /min "%TWIN_PYTHON%" -m http.server 4174 --bind 127.0.0.1 --directory dist
powershell -NoProfile -Command "Start-Process -FilePath '%TWIN_PYTHON%' -ArgumentList 'observation_server.py' -WindowStyle Hidden"
powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:4174'"
endlocal
