#!/bin/bash
# scripts/restore_db.sh
# Kịch bản khôi phục dữ liệu thảm họa (Disaster Recovery)

BACKUP_DIR="${BACKUP_DIR:-/home/ubuntu/clinic_backups}"
if [ ! -d "/home/ubuntu" ]; then
    BACKUP_DIR="$(pwd)/backups"
fi

CONTAINER_NAME="clinic_db"
DB_USER="clinic_admin"
DB_NAME="clinic_management"

# Tìm file backup mới nhất (.sql.gz hoặc .sql)
LATEST_BACKUP=$(ls -t $BACKUP_DIR/clinic_backup_*.sql.gz $BACKUP_DIR/clinic_backup_*.sql 2>/dev/null | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
    echo "[LỖI] Không tìm thấy bản backup nào trong $BACKUP_DIR!"
    exit 1
fi

echo "==> Bản sao lưu gần nhất: $LATEST_BACKUP"
echo "==> Đang tiến hành nạp dữ liệu vào container $CONTAINER_NAME..."

if [[ "$LATEST_BACKUP" == *.gz ]]; then
    gunzip -c "$LATEST_BACKUP" | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME
else
    cat "$LATEST_BACKUP" | docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME
fi

if [ $? -eq 0 ]; then
    echo "==> KHÔI PHỤC THÀNH CÔNG!"
    echo "==> Kiểm tra số lượng bệnh nhân sau khôi phục:"
    docker exec -i $CONTAINER_NAME psql -U $DB_USER -d $DB_NAME -c "SELECT count(*) AS total_patients FROM patients;"
else
    echo "==> [LỖI] Khôi phục thất bại!"
    exit 1
fi
