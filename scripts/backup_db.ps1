# scripts/backup_db.ps1
# Script tự động sao lưu dữ liệu cho môi trường Windows PowerShell

chcp 65001 >$null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$BackupDir = Join-Path $PSScriptRoot "..\backups"
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$ContainerName = "clinic_db"
$DbUser = "clinic_admin"
$DbName = "clinic_management"
$BackupSqlFile = Join-Path $BackupDir "clinic_backup_$Timestamp.sql"

Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Bắt đầu sao lưu cơ sở dữ liệu phòng khám trên Windows..." -ForegroundColor Cyan

# Thực thi lệnh pg_dump xuất ra file .sql với cờ --clean --if-exists (loại bỏ -t để tránh lỗi TTY)
cmd.exe /c "docker exec -i $ContainerName pg_dump -U $DbUser --clean --if-exists $DbName > `"$BackupSqlFile`""

if ($LASTEXITCODE -eq 0 -and (Test-Path $BackupSqlFile) -and ((Get-Item $BackupSqlFile).Length -gt 0)) {
    $FileSize = (Get-Item $BackupSqlFile).Length
    Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] Sao lưu thành công: $BackupSqlFile (Kích thước: $($FileSize) bytes)" -ForegroundColor Green
} else {
    Write-Host "[$((Get-Date).ToString('yyyy-MM-dd HH:mm:ss'))] LỖI: Quá trình sao lưu thất bại!" -ForegroundColor Red
}
