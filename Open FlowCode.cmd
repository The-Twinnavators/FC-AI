@echo off
rem Opens the desktop app on this folder's FlowCode data (.flowcode-data), the same projects the development tabs show.
rem The development service uses that data too, so only one may run at a time.
setlocal
set "HERE=%~dp0"
curl -s -o nul --max-time 2 http://127.0.0.1:7457/health
if not errorlevel 1 (
  echo The development FlowCode is running and using the same projects.
  echo Stop it first ^(close its terminal, or Ctrl+C in "npm run dev"^), then open this again.
  pause
  exit /b 1
)
set "FLOWCODE_DATA_DIR=%HERE%.flowcode-data"
start "" "%HERE%apps\desktop\release\win-unpacked\FlowCode.exe"
