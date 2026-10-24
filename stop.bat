@echo off
chcp 65001 >nul
echo =====================================================================
echo    HỆ THỐNG QUẢN LÝ PHÒNG KHÁM (HMS) - DOCKER COMPOSE SHUTDOWN
echo    Môn: Triển Khai và Quản Trị Hệ Thống Phần Mềm
echo =====================================================================
echo.
echo Đang dừng và gỡ các container hệ thống (dữ liệu Database vẫn được bảo toàn)...
docker compose down

if %ERRORLEVEL% EQU 0 (
    echo.
    echo =====================================================================
    echo   ĐÃ DỪNG HỆ THỐNG THÀNH CÔNG!
    echo =====================================================================
    echo   - Các container và mạng ảo đã được dừng an toàn.
    echo   - Dữ liệu Database (PostgreSQL) và Grafana vẫn an toàn trong Volumes.
    echo   - Khi cần khởi động lại, chỉ cần chạy lại file start.bat!
    echo =====================================================================
) else (
    echo.
    echo [LỖI] Có lỗi trong quá trình dừng hệ thống!
)
echo.
pause
