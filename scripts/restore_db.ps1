# scripts/restore_db.ps1
# Script khôi phục thảm họa (Disaster Recovery) trên Windows PowerShell

chcp 65001 >$null
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$BackupDir = Join-Path $PSScriptRoot "..\backups"
$ContainerName = "clinic_db"
$DbUser = "clinic_admin"
$DbName = "clinic_management"

$LatestBackup = Get-ChildItem -Path $BackupDir -Filter "clinic_backup_*.sql" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $LatestBackup) {
    Write-Host "[LỖI] Không tìm thấy bản backup nào trong $BackupDir!" -ForegroundColor Red
    exit 1
}

Write-Host "==> Bản sao lưu gần nhất: $($LatestBackup.FullName)" -ForegroundColor Cyan
Write-Host "==> Đang nạp dữ liệu vào container $ContainerName..." -ForegroundColor Yellow

cmd.exe /c "docker exec -i $ContainerName psql -U $DbUser -d $DbName < `"$($LatestBackup.FullName)`""

if ($LASTEXITCODE -eq 0) {
    Write-Host "==> KHÔI PHỤC THÀNH CÔNG!" -ForegroundColor Green
    Write-Host "==> Kiểm tra lại dữ liệu bệnh nhân:" -ForegroundColor Cyan
    docker exec -i $ContainerName psql -U $DbUser -d $DbName -c "SELECT count(*) AS total_patients FROM patients;"
} else {
    Write-Host "==> [LỖI] Khôi phục thất bại!" -ForegroundColor Red
}
