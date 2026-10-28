@echo off
setlocal
cd /d "%~dp0"
set "TWIN_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not exist "%TWIN_PYTHON%" set "TWIN_PYTHON=python"
powershell -NoProfile -Command "Start-Process -FilePath '%TWIN_PYTHON%' -ArgumentList 'observation_server.py' -WindowStyle Hidden"
powershell -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:4175'"
endlocal
