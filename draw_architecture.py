# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw, ImageFont

# Canvas setup
width, height = 1600, 960
img = Image.new("RGB", (width, height), "#F8FAFC")
draw = ImageDraw.Draw(img)

# Load fonts
try:
    font_title = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 26)
    font_sub = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 15)
    font_zone = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 16)
    font_box_title = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 15)
    font_box_text = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 12)
    font_tag = ImageFont.truetype("C:/Windows/Fonts/segoeuib.ttf", 11)
except:
    font_title = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 26)
    font_sub = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 15)
    font_zone = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 16)
    font_box_title = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 15)
    font_box_text = ImageFont.truetype("C:/Windows/Fonts/arial.ttf", 12)
    font_tag = ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", 11)

def draw_rounded_rect(draw, bbox, fill, outline, width=1, radius=10):
    draw.rounded_rectangle(bbox, radius=radius, fill=fill, outline=outline, width=width)

# 1. TOP HEADER BANNER
draw_rounded_rect(draw, [40, 30, width - 40, 110], "#0F172A", "#1E293B", radius=12)
draw.text((70, 42), "HỆ THỐNG QUẢN LÝ PHÒNG KHÁM (HMS) - KIẾN TRÚC ĐA TẦNG DOCKER COMPOSE", fill="#F8FAFC", font=font_title)
draw.text((70, 78), "Sinh viên: Lê Quang Hưng  |  Lớp: KTPM K23B  |  Khoa: Công nghệ thông tin  |  3 Mạng Cô Lập: frontend_net • backend_net • monitor_net", fill="#38BDF8", font=font_sub)

# 2. CLIENT / EXTERNAL USERS LAYER
client_box = [60, 130, 480, 210]
draw_rounded_rect(draw, client_box, "#FFFFFF", "#CBD5E1", width=2, radius=8)
draw.text((80, 142), "🌐 NGƯỜI DÙNG TRÌNH DUYỆT (CLIENT BROWSER)", fill="#0F172A", font=font_box_title)
draw.text((80, 168), "• Tiếp Tân (letan01)   • Bác Sĩ (bacsi_nam, bacsi_hoa)\n• Thu Ngân (thungan01)  • Quản Trị Viên (admin)", fill="#475569", font=font_box_text)

# Arrow from Client to Nginx Proxy
draw.line([(480, 170), (570, 170)], fill="#0D9488", width=3)
draw.polygon([(575, 170), (565, 164), (565, 176)], fill="#0D9488")
draw.text((490, 145), "Port 80/443", fill="#0D9488", font=font_tag)

# 3. NGINX REVERSE PROXY CONTAINER (The Gateway)
proxy_box = [580, 130, 1020, 220]
draw_rounded_rect(draw, proxy_box, "#F0FDF4", "#16A34A", width=2, radius=10)
draw.text((600, 142), "🛡️ 1. NGINX REVERSE PROXY (clinic_proxy:alpine)", fill="#15803D", font=font_box_title)
draw.text((600, 168), "• SSL/TLS Termination (HTTPS Port 443)  • Gzip Data Compression\n• Rate Limiting: 10 req/s, burst=20 (Chống DoS/Spam cấp số khám)\n• Static Volume Phục Vụ Trực Tiếp Ảnh X-quang/Siêu Âm Tới 50MB", fill="#1E293B", font=font_box_text)

# 4. ZONE 1: FRONTEND_NET (DMZ / Public App Network)
z1_box = [60, 250, 520, 680]
draw_rounded_rect(draw, z1_box, "#F0F9FF", "#0284C7", width=2, radius=12)
draw.text((80, 265), "VÙNG MẠNG 1: frontend_net (Public App DMZ)", fill="#0369A1", font=font_zone)

# Box: clinic_frontend
fe_box = [80, 310, 500, 460]
draw_rounded_rect(draw, fe_box, "#FFFFFF", "#BAE6FD", width=2, radius=8)
draw.text((100, 325), "💻 2. FRONTEND PORTAL (clinic_frontend)", fill="#0284C7", font=font_box_title)
draw.text((100, 352), "• Nginx:alpine phục vụ Web tĩnh SPA\n• HTML5, CSS3 Glassmorphism, Vanilla JS\n• RBAC 4 phân hệ: Tiếp nhận, Khám EMR, Thu ngân, Admin\n• Kết nối nội bộ qua Cổng 80", fill="#334155", font=font_box_text)

# Box: clinic_api
be_box = [80, 490, 500, 655]
draw_rounded_rect(draw, be_box, "#FFFFFF", "#BAE6FD", width=2, radius=8)
draw.text((100, 505), "⚙️ 3. BACKEND API (clinic_api)", fill="#0284C7", font=font_box_title)
draw.text((100, 532), "• Node.js 18 Express API (Port 8000 nội bộ)\n• Nghiệp vụ khám bệnh, kê đơn, tính viện phí\n• Prometheus Metrics endpoint (/metrics)\n• Healthcheck endpoint (/health)", fill="#334155", font=font_box_text)

# 5. ZONE 2: BACKEND_NET (Private Secure Network - Zero Host Port Mapping)
z2_box = [550, 250, 1050, 680]
draw_rounded_rect(draw, z2_box, "#FEF2F2", "#DC2626", width=2, radius=12)
draw.text((570, 265), "VÙNG MẠNG 2: backend_net (Isolated Private - Bảo Mật CSDL)", fill="#B91C1C", font=font_zone)
draw.text((570, 288), "⛔ TUYỆT ĐỐI KHÔNG MỞ CỔNG RA HOST (Chống Port Scan & Nghe lén)", fill="#DC2626", font=font_tag)

# Box: clinic_db
db_box = [570, 320, 1030, 485]
draw_rounded_rect(draw, db_box, "#FFFFFF", "#FECACA", width=2, radius=8)
draw.text((590, 335), "🗄️ 4. POSTGRESQL 15 CSDL BỆNH ÁN (clinic_db)", fill="#B91C1C", font=font_box_title)
draw.text((590, 362), "• CSDL clinic_management chuẩn 3NF (10 bảng thực thể y tế)\n• Port 5432 nội bộ (Chỉ backend_net được kết nối)\n• Volume pgdata lưu trữ bền vững (Persistent Storage)\n• Healthcheck tự động: pg_isready (Condition-based startup)", fill="#334155", font=font_box_text)

# Box: clinic_redis
redis_box = [570, 510, 1030, 655]
draw_rounded_rect(draw, redis_box, "#FFFFFF", "#FECACA", width=2, radius=8)
draw.text((590, 525), "⚡ 5. REDIS 7 ATOMIC QUEUE & CACHE (clinic_redis)", fill="#B91C1C", font=font_box_title)
draw.text((590, 552), "• Port 6379 nội bộ\n• Cấp số khám nguyên tử: INCR clinic:queue_counter:<date>\n  (Triệt tiêu Race Condition khi nhiều quầy tiếp nhận cùng lúc)\n• In-memory Cache danh mục thuốc & cận lâm sàng (TTL 300s)\n• Tự động Fallback sang PostgreSQL nếu Redis sự cố", fill="#334155", font=font_box_text)

# 6. ZONE 3: MONITOR_NET (Observability & Metrics Network)
z3_box = [1080, 250, 1540, 680]
draw_rounded_rect(draw, z3_box, "#F5F3FF", "#7C3AED", width=2, radius=12)
draw.text((1100, 265), "VÙNG MẠNG 3: monitor_net (Giám Sát Hạ Tầng)", fill="#6D28D9", font=font_zone)

# Box: clinic_node_exporter
ne_box = [1100, 310, 1520, 420]
draw_rounded_rect(draw, ne_box, "#FFFFFF", "#DDD6FE", width=2, radius=8)
draw.text((1120, 325), "📊 6. NODE EXPORTER (clinic_node_exporter)", fill="#6D28D9", font=font_box_title)
draw.text((1120, 350), "• Cổng 9100 nội bộ\n• Trích xuất thông số phần cứng máy chủ host: CPU %, RAM %, I/O đĩa", fill="#334155", font=font_box_text)

# Box: clinic_prometheus
prom_box = [1100, 440, 1520, 545]
draw_rounded_rect(draw, prom_box, "#FFFFFF", "#DDD6FE", width=2, radius=8)
draw.text((1120, 455), "🔥 7. PROMETHEUS TSDB (clinic_prometheus)", fill="#6D28D9", font=font_box_title)
draw.text((1120, 480), "• Port 9090 (Giao diện web PromQL)\n• Scrape 15s/lần: backend:8000/metrics & node_exporter:9100", fill="#334155", font=font_box_text)

# Box: clinic_grafana
graf_box = [1100, 565, 1520, 665]
draw_rounded_rect(draw, graf_box, "#FFFFFF", "#DDD6FE", width=2, radius=8)
draw.text((1120, 580), "📈 8. GRAFANA DASHBOARD (clinic_grafana)", fill="#6D28D9", font=font_box_title)
draw.text((1120, 605), "• Port 3000 (admin/admin)\n• Tự động nạp Dashboard HMS Overview (8 Panels trực quan)\n• Doanh thu viện phí live, ca chờ khám, ca hoàn tất, CPU/RAM %", fill="#334155", font=font_box_text)

# 7. BOTTOM LAYER: DOCKER PERSISTENT VOLUMES
vol_box = [60, 710, width - 60, 850]
draw_rounded_rect(draw, vol_box, "#FFFBEB", "#D97706", width=2, radius=12)
draw.text((80, 725), "💾 HỆ THỐNG DOCKER PERSISTENT VOLUMES (LƯU TRỮ DỮ LIỆU BỀN VỮNG)", fill="#B45309", font=font_zone)

# Volume items
v_items = [
    ("pgdata", "/var/lib/postgresql/data", "Lưu trữ toàn bộ CSDL bệnh án PostgreSQL, bảo toàn 100% dữ liệu khi container restart"),
    ("clinic_static", "/app/uploads & /var/www/static", "Chia sẻ ảnh X-quang/siêu âm giữa Backend (ghi) và Nginx (đọc trực tiếp)"),
    ("promdata", "/prometheus", "Lưu trữ dữ liệu chuỗi thời gian số liệu giám sát của Prometheus"),
    ("grafanadata", "/var/lib/grafana", "Lưu trữ cấu hình dashboard, alerts và tài khoản quản trị Grafana")
]

for idx, (v_name, v_path, v_desc) in enumerate(v_items):
    bx = 80 + idx * 360
    b_item = [bx, 755, bx + 345, 835]
    draw_rounded_rect(draw, b_item, "#FFFFFF", "#FDE68A", width=1, radius=6)
    draw.text((bx + 12, 765), f"📁 Volume: {v_name}", fill="#B45309", font=font_box_title)
    draw.text((bx + 12, 788), f"Mount: {v_path}\n{v_desc}", fill="#475569", font=font_box_text)

# Footer caption
draw.text((width - 450, height - 35), "Triển khai & Quản trị Hệ thống Phần mềm - 2026", fill="#64748B", font=font_tag)

# Save high-res image
img.save("so_do_kien_truc.png", "PNG", dpi=(300, 300))
print("Successfully generated so_do_kien_truc.png (1600x960)")
