@echo off
chcp 65001 >nul
echo =====================================================================
echo    HỆ THỐNG QUẢN LÝ PHÒNG KHÁM (HMS) - DOCKER COMPOSE LAUNCHER
echo    Môn: Triển Khai và Quản Trị Hệ Thống Phần Mềm
echo =====================================================================
echo.

echo [1/3] Đang kiểm tra trạng thái Docker Desktop...
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [LỖI] Docker Desktop chưa được khởi động!
    echo Vui lòng mở ứng dụng Docker Desktop trên Windows và thử lại.
    pause
    exit /b 1
)

echo [2/3] Đang build và khởi động các container qua Docker Compose...
docker compose up -d --build

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [3/3] Khởi động hoàn tất! Đang mở trình duyệt...
    echo.
    echo =====================================================================
    echo   KHỞI ĐỘNG HỆ THỐNG THÀNH CÔNG!
    echo =====================================================================
    echo   - Giao diện ứng dụng chính:   http://localhost (Cổng 80/443 - qua Nginx)
    echo   - API Healthcheck:            http://localhost/api/health
    echo   - Prometheus Metrics API:     http://localhost/api/metrics
    echo   - Prometheus Dashboard:       http://localhost:9090
    echo   - Giám sát Grafana:           http://localhost:3000 (user: admin / pass: admin)
    echo =====================================================================
    echo.
    start http://localhost
) else (
    echo.
    echo [LỖI] Có lỗi trong quá trình khởi động container!
)

pause
