@echo off
setlocal
set "TR_NODE=%~dp0node\node.exe"
if not exist "%TR_NODE%" set "TR_NODE=node"
"%TR_NODE%" "%~dp0trigger-recovery.mjs" %*
exit /b %ERRORLEVEL%
