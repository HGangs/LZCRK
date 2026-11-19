@echo off
chcp 65001 >nul
title 出入库存工作台 - 本地服务 127.0.0.1:58169
cd /d "%~dp0"
echo.
echo   出入库存工作台正在启动...
echo   地址: http://127.0.0.1:58169/index.html
echo   请不要关闭这个黑窗口，关闭即停止服务。
echo.

set "PYEXE="
if exist "%USERPROFILE%\.workbuddy\binaries\python\versions\3.13.12\python.exe" set "PYEXE=%USERPROFILE%\.workbuddy\binaries\python\versions\3.13.12\python.exe"
if not defined PYEXE if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set "PYEXE=%LOCALAPPDATA%\Programs\Python\Python313\python.exe"
if not defined PYEXE if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PYEXE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if not defined PYEXE if exist "C:\Python313\python.exe" set "PYEXE=C:\Python313\python.exe"
if not defined PYEXE if exist "C:\Python312\python.exe" set "PYEXE=C:\Python312\python.exe"

if not defined PYEXE (
  echo [错误] 未找到可用的 Python。
  echo.
  echo   请改用桌面客户端，双击下面这个文件：
  echo   "%~dp0客户端\出入库存工作台-win32-x64\出入库存工作台.exe"
  echo.
  pause
  exit /b 1
)

echo 使用: %PYEXE%
start "" "http://127.0.0.1:58169/index.html"
"%PYEXE%" -m http.server 58169 --bind 127.0.0.1
echo.
echo 服务已停止。
pause
