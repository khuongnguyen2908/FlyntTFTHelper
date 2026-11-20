@echo off
chcp 65001 >nul
title TFT Helper - doc man hinh
rem Doc chu tren man hinh TFT, web/index.html tu cap nhat. Dong cua so nay de dung.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\ocr-live.ps1"
pause
