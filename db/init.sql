-- clinic_init.sql
-- 1. BẢNG PHÂN QUYỀN VÀ TÀI KHOẢN
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO roles (name) VALUES
('ADMIN'),
('RECEPTIONIST'),
('DOCTOR'),
('PATIENT'),
('CASHIER')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role_id INT REFERENCES roles(id) ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mật khẩu mặc định: 123456
INSERT INTO users (username, password_hash, full_name, phone, role_id) VALUES
('admin', 'scrypt:32768:8:1$hashed_admin', 'Quản Trị Viên Hệ Thống', '0901234567', (SELECT id FROM roles WHERE name = 'ADMIN')),
('letan01', 'scrypt:32768:8:1$hashed_staff', 'Nguyễn Thị Hoa (Lễ Tân)', '0912345678', (SELECT id FROM roles WHERE name = 'RECEPTIONIST')),
('bacsi_nam', 'scrypt:32768:8:1$hashed_doc', 'BS CK1. Trần Văn Nam', '0987654321', (SELECT id FROM roles WHERE name = 'DOCTOR')),
('bacsi_hoa', 'scrypt:32768:8:1$hashed_doc2', 'ThS. BS. Lê Thị Mai Hoa', '0988112233', (SELECT id FROM roles WHERE name = 'DOCTOR')),
('bacsi_long', 'scrypt:32768:8:1$hashed_doc3', 'BS CK2. Nguyễn Hoàng Long', '0977665544', (SELECT id FROM roles WHERE name = 'DOCTOR')),
('bacsi_tuan', 'scrypt:32768:8:1$hashed_doc4', 'BS. Phạm Minh Tuấn', '0966554433', (SELECT id FROM roles WHERE name = 'DOCTOR')),
('thungan01', 'scrypt:32768:8:1$hashed_cashier', 'Phạm Thị Lan (Thu Ngân)', '0919988776', (SELECT id FROM roles WHERE name = 'CASHIER')),
('benhnhan01', 'scrypt:32768:8:1$hashed_pat', 'Lê Văn An', '0933221100', (SELECT id FROM roles WHERE name = 'PATIENT')),
('benhnhan02', 'scrypt:32768:8:1$hashed_pat2', 'Trần Thị Mai', '0977889900', (SELECT id FROM roles WHERE name = 'PATIENT'))
ON CONFLICT (username) DO NOTHING;

-- 2. BẢNG CHUYÊN KHOA VÀ BÁC SĨ
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT
);

INSERT INTO departments (name, description) VALUES
('Khoa Nội Tổng Quát', 'Khám, sàng lọc và điều trị các bệnh nội khoa'),
('Khoa Tai Mũi Họng', 'Chuyên khoa bệnh lý Tai - Mũi - Họng'),
('Khoa Chẩn Đoán Hình Ảnh', 'Chụp X-quang, Siêu âm màu'),
('Khoa Nhi & Hô Hấp', 'Khám, tư vấn và điều trị các bệnh lý Nhi khoa')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    department_id INT REFERENCES departments(id) ON DELETE SET NULL,
    room_number VARCHAR(20) NOT NULL
);

INSERT INTO doctors (user_id, department_id, room_number) VALUES
((SELECT id FROM users WHERE username = 'bacsi_nam'), 1, 'P.102'),
((SELECT id FROM users WHERE username = 'bacsi_hoa'), 2, 'P.201'),
((SELECT id FROM users WHERE username = 'bacsi_long'), 4, 'P.105'),
((SELECT id FROM users WHERE username = 'bacsi_tuan'), 3, 'P.301')
ON CONFLICT DO NOTHING;

-- 3. HỒ SƠ BỆNH NHÂN
CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE SET NULL,
    identity_card VARCHAR(20) UNIQUE,
    dob DATE NOT NULL,
    gender VARCHAR(10) NOT NULL,
    address TEXT,
    medical_history TEXT
);

INSERT INTO patients (user_id, identity_card, dob, gender, address, medical_history) VALUES
((SELECT id FROM users WHERE username = 'benhnhan01'), '001200009988', '1995-04-12', 'Nam', 'Thái Nguyên', 'Tiền sử dị ứng Penicillin'),
((SELECT id FROM users WHERE username = 'benhnhan02'), '001201008877', '1998-08-20', 'Nữ', 'Hà Nội', 'Không có tiền sử bệnh lý mạn tính')
ON CONFLICT (identity_card) DO NOTHING;

-- 4. TIẾP NHẬN & HÀNG ĐỢI LỊCH KHÁM
CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    queue_number INT NOT NULL,
    patient_id INT REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id INT REFERENCES doctors(id) ON DELETE RESTRICT,
    appointment_date DATE NOT NULL,
    status VARCHAR(30) DEFAULT 'WAITING', -- WAITING, IN_PROGRESS, COMPLETED, CANCELLED
    symptoms TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO appointments (queue_number, patient_id, doctor_id, appointment_date, status, symptoms) VALUES
(1, (SELECT id FROM patients WHERE identity_card = '001200009988'), (SELECT id FROM doctors WHERE user_id = (SELECT id FROM users WHERE username = 'bacsi_nam')), CURRENT_DATE, 'COMPLETED', 'Đau đầu âm ỉ, sốt nhẹ 38 độ C kéo dài 2 ngày'),
(2, (SELECT id FROM patients WHERE identity_card = '001201008877'), (SELECT id FROM doctors WHERE user_id = (SELECT id FROM users WHERE username = 'bacsi_nam')), CURRENT_DATE, 'WAITING', 'Đau họng, ho khan, mệt mỏi từ chiều qua')
ON CONFLICT DO NOTHING;

-- 5. DANH MỤC DỊCH VỤ CẬN LÂM SÀNG & THUỐC
CREATE TABLE IF NOT EXISTS medical_services (
    id SERIAL PRIMARY KEY,
    service_code VARCHAR(30) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    price NUMERIC(12, 2) NOT NULL
);

INSERT INTO medical_services (service_code, name, price) VALUES
('CLS_XRAY_CHEST', 'Chụp X-quang Ngực Thẳng', 150000),
('CLS_ULTRASOUND', 'Siêu âm Tổng quát Ổ bụng', 200000),
('CLS_BLOOD_TEST', 'Xét nghiệm Công thức Máu (24 chỉ số)', 120000)
ON CONFLICT (service_code) DO NOTHING;

CREATE TABLE IF NOT EXISTS medicines (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    active_substance VARCHAR(100),
    unit VARCHAR(20) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    stock_quantity INT DEFAULT 0
);

INSERT INTO medicines (name, active_substance, unit, unit_price, stock_quantity) VALUES
('Paracetamol 500mg (Hạ sốt & Giảm đau)', 'Paracetamol', 'Vỉ (10 viên)', 15000, 1000),
('Augmentin 625mg (Kháng sinh)', 'Amoxicillin/Clavulanate', 'Vỉ (7 viên)', 85000, 500),
('Vitamin C 500mg (Tăng đề kháng)', 'Acid Ascorbic', 'Vỉ (10 viên)', 20000, 800),
('Siro Ho Prospan 100ml (Thảo dược)', '', 'Chai/Lọ', 75000, 300),
('Men vi sinh Enterogermina (5ml)', '', 'Hộp (20 ống)', 140000, 250),
('Oresol 245 bù nước & điện giải', '', 'Hộp (10 gói)', 35000, 500)
ON CONFLICT DO NOTHING;

-- 6. HỒ SƠ BỆNH ÁN & CHỈ ĐỊNH DỊCH VỤ
CREATE TABLE IF NOT EXISTS medical_records (
    id SERIAL PRIMARY KEY,
    appointment_id INT UNIQUE REFERENCES appointments(id) ON DELETE RESTRICT,
    temperature NUMERIC(4, 1),
    blood_pressure VARCHAR(20),
    diagnosis TEXT NOT NULL,
    doctor_advice TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO medical_records (appointment_id, temperature, blood_pressure, diagnosis, doctor_advice) VALUES
(1, 38.2, '120/80', 'Sốt nhiễm khuẩn hô hấp trên cấp tính', 'Nghỉ ngơi, uống đủ 2 lít nước mỗi ngày')
ON CONFLICT (appointment_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS service_requests (
    id SERIAL PRIMARY KEY,
    record_id INT REFERENCES medical_records(id) ON DELETE CASCADE,
    service_id INT REFERENCES medical_services(id) ON DELETE RESTRICT,
    result_text TEXT,
    result_image_url VARCHAR(255),
    status VARCHAR(30) DEFAULT 'COMPLETED'
);

INSERT INTO service_requests (record_id, service_id, result_text, status) VALUES
(1, 1, 'Hình ảnh tim phổi bình thường, rốn phổi hai bên không ứ huyết', 'COMPLETED')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS prescriptions (
    id SERIAL PRIMARY KEY,
    record_id INT REFERENCES medical_records(id) ON DELETE CASCADE,
    medicine_id INT REFERENCES medicines(id) ON DELETE RESTRICT,
    quantity INT NOT NULL,
    dosage_instructions VARCHAR(255) NOT NULL
);

INSERT INTO prescriptions (record_id, medicine_id, quantity, dosage_instructions) VALUES
(1, 1, 10, 'Uống 1 viên khi sốt trên 38.5 độ C, cách 6 tiếng'),
(1, 3, 10, 'Uống 1 viên sau ăn sáng mỗi ngày')
ON CONFLICT DO NOTHING;

-- 7. HÓA ĐƠN VÀ THANH TOÁN
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    appointment_id INT UNIQUE REFERENCES appointments(id) ON DELETE RESTRICT,
    total_amount NUMERIC(12, 2) NOT NULL,
    payment_status VARCHAR(30) DEFAULT 'PAID', -- UNPAID, PAID
    payment_method VARCHAR(30) DEFAULT 'CASH', -- CASH, TRANSFER
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO invoices (appointment_id, total_amount, payment_status, payment_method) VALUES
(1, 235000, 'PAID', 'TRANSFER')
ON CONFLICT DO NOTHING;
