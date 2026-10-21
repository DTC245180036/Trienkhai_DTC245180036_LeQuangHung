# HỆ THỐNG QUẢN LÝ PHÒNG KHÁM ĐA TẦNG (CLINIC MANAGEMENT SYSTEM - HMS)
## ĐỒ ÁN MÔN HỌC: TRIỂN KHAI VÀ QUẢN TRỊ HỆ THỐNG PHẦN MỀM

* **Trường:** Đại học Công nghệ Thông tin và Truyền thông (ICTU) - Đại học Thái Nguyên
* **Khoa:** Khoa Công nghệ Thông tin - Bộ môn Mạng & Quản trị Hệ thống
* **Sinh viên thực hiện:** Lê Quang Hùng
* **Mã số sinh viên (MSSV):** DTC245180036
* **Lớp:** CNTT K23
* **GitHub Repository:** [https://github.com/DTC245180036/Trienkhai_DTC245180036_LeQuangHung](https://github.com/DTC245180036/Trienkhai_DTC245180036_LeQuangHung)

---

## I. TỔNG QUAN KIẾN TRÚC HỆ THỐNG (DOCKER COMPOSE)

Hệ thống được đóng gói và điều phối hoàn toàn qua **Docker Compose** bao gồm 8 container dịch vụ độc lập, chia làm 3 vùng mạng cách ly:

1. **`clinic_proxy` (Nginx:alpine):** Đóng vai trò Reverse Proxy biên, lắng nghe cổng 80 (HTTP) và 443 (HTTPS), áp dụng Rate Limiting `rate=10r/s burst=20`, nén Gzip, phục vụ trực tiếp file ảnh X-quang/siêu âm dung lượng tới 50MB qua Docker volume tĩnh.
2. **`clinic_frontend` (Nginx:alpine):** Cung cấp giao diện Web Portal SPA hiện đại với phân quyền RBAC 4 vai trò y tế.
3. **`clinic_api` (Node.js 18 Alpine):** Backend API xử lý nghiệp vụ khám bệnh, kết nối CSDL, xuất OpenMetrics tại `/metrics` và healthcheck tại `/health`.
4. **`clinic_db` (PostgreSQL 15 Alpine):** Cơ sở dữ liệu bệnh án 10 bảng chuẩn hóa 3NF, lưu trữ bền vững trên volume `pgdata`, bảo vệ nghiêm ngặt trong mạng nội bộ `backend_net` (cấm map port ra ngoài).
5. **`clinic_redis` (Redis 7 Alpine):** Bộ nhớ đệm và cấp số thứ tự nguyên tử `INCR clinic:queue_counter:<date>` chống Race Condition và cache danh mục y tế.
6. **`clinic_prometheus` (Prometheus TSDB):** Thu thập metrics định kỳ 15s/lần từ ứng dụng và phần cứng máy chủ.
7. **`clinic_grafana` (Grafana):** Bảng điều khiển giám sát trực quan hóa 8 panels, tự động nạp provisioning Datasource & Dashboard *HMS Overview*.
8. **`clinic_node_exporter` (Prom/Node-Exporter):** Trích xuất thông số phần cứng máy chủ host (CPU, RAM, Disk I/O).

---

## II. BẢNG TỔNG HỢP TÀI KHOẢN VÀ CỔNG TRUY CẬP

| Dịch vụ / Phân hệ | Đường dẫn truy cập | Tài khoản | Mật khẩu | Chức năng nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| **Cổng Tiếp Tân** | [http://localhost](http://localhost) | `letan01` | `123456` | Tiếp nhận bệnh nhân, cấp số khám tự động |
| **Bác Sĩ Khám (P.102)** | [http://localhost](http://localhost) | `bacsi_nam` | `123456` | Khám EMR, nhập sinh hiệu, chỉ định CLS, kê đơn |
| **Bác Sĩ Khám (P.201)** | [http://localhost](http://localhost) | `bacsi_hoa` | `123456` | Khám chuyên khoa Tai Mũi Họng, chỉ định thuốc |
| **Quầy Thu Ngân** | [http://localhost](http://localhost) | `thungan01` | `123456` | Thu tiền viện phí (Tiền mặt / QR Pay), in phiếu thu |
| **Quản Trị / DevOps** | [http://localhost](http://localhost) | `admin` | `123456` | Xem sơ đồ mạng, bắn tải test DoS, diễn tập phục hồi |
| **Grafana Monitoring** | [http://localhost:3000](http://localhost:3000) | `admin` | `admin` | Giám sát 8 metrics panel (Doanh thu live, CPU, RAM) |
| **Prometheus TSDB** | [http://localhost:9090](http://localhost:9090) | *(Nội bộ)* | *(Nội bộ)* | Truy vấn PromQL, kiểm tra Scrape Targets |
| **API Healthcheck** | [http://localhost/api/health](http://localhost/api/health) | Công khai | Không | Kiểm tra trạng thái DB, Redis và Uptime |
| **API Metrics** | [http://localhost/api/metrics](http://localhost/api/metrics) | Nội bộ | Không | Cung cấp dữ liệu theo chuẩn OpenMetrics |

---

## III. HƯỚNG DẪN KHỞI CHẠY HỆ THỐNG (1-CLICK)

### Yêu cầu tiên quyết:
* Máy tính đã cài đặt **Docker Desktop** (Engine running).
* Hệ điều hành: Windows 10/11 hoặc Linux.

### Các bước khởi chạy:
```bash
# 1. Clone mã nguồn từ GitHub
git clone https://github.com/DTC245180036/Trienkhai_DTC245180036_LeQuangHung.git
cd Trienkhai_DTC245180036_LeQuangHung

# 2. Khởi động toàn bộ 8 containers
# Cách A: Click đúp vào file start.bat (Khuyên dùng trên Windows)
# Cách B: Chạy lệnh Docker Compose từ Terminal:
docker compose up -d --build

# 3. Kiểm tra trạng thái các container
docker compose ps
```

---

## IV. KỊCH BẢN DIỄN TẬP PHỤC HỒI THẢM HỌA (DISASTER RECOVERY)

Khi xảy ra sự cố xóa nhầm bảng dữ liệu bệnh nhân, thực thi chuỗi lệnh phục hồi trên PowerShell:

```powershell
# Bước 1: Sao lưu dữ liệu hiện tại
.\scripts\backup_db.ps1

# Bước 2: Giả lập thảm họa xóa bảng bệnh nhân
docker exec -i clinic_db psql -U clinic_admin -d clinic_management -c "DROP TABLE patients CASCADE;"

# Bước 3: Kiểm tra bảng đã mất
docker exec -i clinic_db psql -U clinic_admin -d clinic_management -c "SELECT count(*) FROM patients;"

# Bước 4: Chạy script khôi phục thảm họa tự động
.\scripts\restore_db.ps1

# Bước 5: Kiểm tra xác nhận dữ liệu bệnh nhân đã được phục hồi 100%
docker exec -i clinic_db psql -U clinic_admin -d clinic_management -c "SELECT count(*) FROM patients;"
```

---

## V. CÁC BIỆN PHÁP GIA CỐ BẢO MẬT (HARDENING)
1. **Network Isolation:** Phân chia 3 vùng mạng bridge (`frontend_net`, `backend_net`, `monitor_net`). PostgreSQL cấm map port ra ngoài.
2. **Bảo mật Biến môi trường:** Tệp `.env` được bảo vệ và loại trừ khỏi Git qua `.gitignore`.
3. **Healthcheck Condition:** Backend chỉ khởi động khi PostgreSQL sẵn sàng qua lệnh `pg_isready`.
4. **Persistent Volumes:** Dữ liệu CSDL lưu tại `pgdata` và ảnh lưu tại `clinic_static`, không bị mất khi restart container.
5. **Nginx Rate Limiting:** Giới hạn 10 req/s burst 20, chống spam cấp số khám và DoS.
6. **RBAC Enforcement:** Phân quyền nghiêm ngặt giữa 4 tác nhân Tiếp tân, Bác sĩ, Thu ngân và Admin.
