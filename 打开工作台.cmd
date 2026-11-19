@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
set "DIR=%~dp0客户端\出入库存工作台-win32-x64"
set "APP="
rem 优先使用带版本号的 exe（新包），没有则退回任意 exe
for %%f in ("%DIR%\*_v*.exe") do if not defined APP set "APP=%%f"
if not defined APP for %%f in ("%DIR%\*.exe") do if not defined APP set "APP=%%f"
if not defined APP (
  echo [错误] 未在客户端目录找到 exe：
  echo   %DIR%
  echo 请先解压 dist\ 下的桌面客户端压缩包到 客户端\ 目录。
  pause
  exit /b 1
)
echo 启动：!APP!
start "" "!APP!"
exit
