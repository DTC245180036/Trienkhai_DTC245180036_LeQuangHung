#!/bin/bash
# scripts/backup_db.sh
# Script tự động dump PostgreSQL và nén lưu trữ

BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/clinic_backups}"
# Nếu không tồn tại /home/ubuntu thì dùng thư mục ./backups cục bộ
if [ ! -d "/home/ubuntu" ]; then
    BACKUP_DIR="$(pwd)/backups"
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
CONTAINER_NAME="clinic_db"
DB_USER="clinic_admin"
DB_NAME="clinic_management"
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/clinic_backup_${TIMESTAMP}.sql.gz"

echo "[$(date)] Bắt đầu sao lưu cơ sở dữ liệu phòng khám..."

# Thực thi lệnh pg_dump trực tiếp trong container (dùng -i, không dùng -t để chạy an toàn trong cronjob) với --clean --if-exists
docker exec -i $CONTAINER_NAME pg_dump -U $DB_USER --clean --if-exists $DB_NAME | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "[$(date)] Sao lưu thành công: $BACKUP_FILE"
  echo "Kích thước tệp: $(du -h "$BACKUP_FILE" | cut -f1)"
else
  echo "[$(date)] LỖI: Quá trình sao lưu thất bại!" >&2
  exit 1
fi

# Xóa các bản lưu trữ cũ hơn 7 ngày để giải phóng dung lượng đĩa
echo "Dọn dẹp các bản sao lưu cũ hơn $RETENTION_DAYS ngày..."
find "$BACKUP_DIR" -type f -name "clinic_backup_*.sql.gz" -mtime +$RETENTION_DAYS -exec rm -f {} \;

echo "[$(date)] Hoàn tất chu kỳ sao lưu."
