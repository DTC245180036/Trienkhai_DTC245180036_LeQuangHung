const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const Redis = require('ioredis');
const client = require('prom-client');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8000;

// ==========================================
// 1. PROMETHEUS METRICS CONFIGURATION
// ==========================================
const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'clinic_' });

const httpRequestCounter = new client.Counter({
  name: 'clinic_http_requests_total',
  help: 'Total number of HTTP requests processed by Clinic API',
  labelNames: ['method', 'route', 'status_code'],
});
register.registerMetric(httpRequestCounter);

const httpRequestDuration = new client.Histogram({
  name: 'clinic_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});
register.registerMetric(httpRequestDuration);

// ==========================================
// 2. MIDDLEWARES
// ==========================================
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Upload directory setup
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });
app.use('/uploads', express.static(uploadDir));

// Metrics collection middleware
app.use((req, res, next) => {
  const start = process.hrtime();
  res.on('finish', () => {
    const duration = process.hrtime(start);
    const durationInSeconds = duration[0] + duration[1] / 1e9;
    const route = req.route ? req.route.path : req.path;
    httpRequestCounter.inc({ method: req.method, route, status_code: res.statusCode });
    httpRequestDuration.observe({ method: req.method, route, status_code: res.statusCode }, durationInSeconds);
  });
  next();
});

// ==========================================
// 3. DATABASE & CACHE CONNECTION
// ==========================================
const dbConfig = {
  host: process.env.DB_HOST || 'postgres_db',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'clinic_management',
  user: process.env.DB_USER || 'clinic_admin',
  password: process.env.DB_PASSWORD || 'ClinicSecurePass2026!',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

const pool = new Pool(dbConfig);
pool.on('error', (err) => {
  console.error('[DB Error] Unexpected error on idle client', err);
});

// Redis client (with graceful fallback)
let redisConnected = false;
const redis = new Redis({
  host: process.env.REDIS_HOST || 'clinic_redis',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => Math.min(times * 1000, 5000)
});
redis.on('connect', () => {
  redisConnected = true;
  console.log('[Redis] Connected successfully to clinic_redis');
});
redis.on('error', (err) => {
  redisConnected = false;
  // silent warning to prevent log flooding
});

// ==========================================
// 4. SYSTEM & MONITORING ROUTES
// ==========================================

// Root API Endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'Medicare Clinic Management API (HMS)',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      metrics: '/metrics',
      stats: '/stats',
      doctors: '/doctors',
      departments: '/departments',
      patients: '/patients',
      appointments: '/appointments',
      medical_services: '/medical-services',
      medicines: '/medicines',
      invoices: '/invoices'
    }
  });
});

// Prometheus Metrics endpoint for Prometheus scrape
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err);
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    const dbRes = await pool.query('SELECT NOW() as db_time');
    dbStatus = dbRes.rows.length ? 'healthy' : 'unknown';
  } catch (e) {
    dbStatus = 'error: ' + e.message;
  }

  res.json({
    status: dbStatus === 'healthy' ? 'UP' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    database: dbStatus,
    redis: redisConnected ? 'healthy' : 'offline_or_fallback',
    uptime_seconds: process.uptime()
  });
});

// ==========================================
// 5. AUTHENTICATION (DEMO FRIENDLY)
// ==========================================
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Vui lòng cung cấp username và password' });
  }

  try {
    const query = `
      SELECT u.id, u.username, u.full_name, u.phone, u.role_id, r.name as role_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.username = $1
    `;
    const result = await pool.query(query, [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Tài khoản không tồn tại trong hệ thống' });
    }

    const user = result.rows[0];

    // Chấp nhận mật khẩu mẫu '123456' hoặc khớp
    if (password !== '123456' && password !== 'admin123') {
      return res.status(401).json({ error: 'Mật khẩu không chính xác (mật khẩu mẫu: 123456)' });
    }

    // Nếu là Bác sĩ, lấy thêm thông tin phòng khám và chuyên khoa
    let doctorInfo = null;
    if (user.role_name === 'DOCTOR') {
      const docRes = await pool.query(`
        SELECT d.id as doctor_id, d.room_number, dep.name as department_name
        FROM doctors d
        LEFT JOIN departments dep ON d.department_id = dep.id
        WHERE d.user_id = $1
      `, [user.id]);
      if (docRes.rows.length > 0) {
        doctorInfo = docRes.rows[0];
      }
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role_name,
        doctor: doctorInfo
      },
      token: 'demo-jwt-token-' + user.id + '-' + Date.now()
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Lỗi máy chủ khi đăng nhập: ' + err.message });
  }
});

// ==========================================
// 6. DASHBOARD & STATS API (FOR ADMIN)
// ==========================================
app.get('/stats', async (req, res) => {
  const { date } = req.query;
  try {
    const totalPatients = await pool.query('SELECT count(*) FROM patients');
    
    // Tổng doanh thu thực thu tích lũy toàn hệ thống
    const totalRevenueRes = await pool.query(`
      SELECT COALESCE(SUM(total_amount), 0) as total 
      FROM invoices 
      WHERE payment_status = 'PAID'
    `);
    const totalRevenue = parseFloat(totalRevenueRes.rows[0].total);

    let waitingQuery = "SELECT count(*) FROM appointments WHERE status = 'WAITING'";
    let completedQuery = "SELECT count(*) FROM appointments WHERE status = 'COMPLETED'";
    let appCountQuery = "SELECT count(*) FROM appointments";
    let revQuery = `
      SELECT COALESCE(SUM(i.total_amount), 0) as total 
      FROM invoices i 
      JOIN appointments a ON i.appointment_id = a.id 
      WHERE i.payment_status = 'PAID'
    `;
    const params = [];

    if (date === 'all') {
      // Lấy toàn bộ lịch sử không giới hạn ngày
    } else if (date && date !== 'today') {
      params.push(date);
      waitingQuery += ` AND appointment_date = $1`;
      completedQuery += ` AND appointment_date = $1`;
      appCountQuery += ` WHERE appointment_date = $1`;
      revQuery += ` AND a.appointment_date = $1`;
    } else {
      // Mặc định hoặc 'today': ngày hôm nay
      waitingQuery += ` AND (appointment_date = CURRENT_DATE OR status = 'WAITING')`;
      completedQuery += ` AND appointment_date = CURRENT_DATE`;
      appCountQuery += ` WHERE appointment_date = CURRENT_DATE`;
      revQuery += ` AND (a.appointment_date = CURRENT_DATE OR DATE(i.created_at) = CURRENT_DATE)`;
    }

    const waitingQueue = await pool.query(waitingQuery, params);
    const completedQueue = await pool.query(completedQuery, params);
    const dateAppointments = await pool.query(appCountQuery, params);
    const dateRevenue = await pool.query(revQuery, params);

    res.json({
      total_patients: parseInt(totalPatients.rows[0].count, 10),
      selected_date: date || 'today',
      date_appointments: parseInt(dateAppointments.rows[0].count, 10),
      today_appointments: parseInt(dateAppointments.rows[0].count, 10),
      waiting_queue: parseInt(waitingQueue.rows[0].count, 10),
      completed_queue: parseInt(completedQueue.rows[0].count, 10),
      today_revenue: parseFloat(dateRevenue.rows[0].total),
      date_revenue: parseFloat(dateRevenue.rows[0].total),
      total_revenue: totalRevenue
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. DEPARTMENTS & DOCTORS
// ==========================================
app.get('/departments', async (req, res) => {
  try {
    // 1. Kiểm tra cache Redis
    if (redisConnected) {
      try {
        const cached = await redis.get('clinic:cache:departments');
        if (cached) return res.json(JSON.parse(cached));
      } catch (cacheErr) {
        console.warn('[Redis] Cache read error, falling back to DB:', cacheErr.message);
      }
    }

    const result = await pool.query('SELECT * FROM departments ORDER BY id ASC');

    // 2. Lưu cache 5 phút (300s)
    if (redisConnected) {
      try {
        await redis.setex('clinic:cache:departments', 300, JSON.stringify(result.rows));
      } catch (e) {}
    }

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/doctors', async (req, res) => {
  try {
    const query = `
      SELECT d.id, d.room_number, u.full_name, u.phone, dep.name as department_name, dep.id as department_id
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      LEFT JOIN departments dep ON d.department_id = dep.id
      ORDER BY d.id ASC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. PATIENTS (HỒ SƠ BỆNH NHÂN)
// ==========================================
app.get('/patients', async (req, res) => {
  const { search } = req.query;
  try {
    let query = `
      SELECT p.*, u.full_name, u.phone 
      FROM patients p
      LEFT JOIN users u ON p.user_id = u.id
    `;
    let params = [];
    if (search) {
      query += ` WHERE p.identity_card ILIKE $1 OR u.full_name ILIKE $1 OR u.phone ILIKE $1`;
      params.push(`%${search}%`);
    }
    query += ` ORDER BY p.id DESC LIMIT 50`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/patients', async (req, res) => {
  const { full_name, phone, identity_card, dob, gender, address, medical_history } = req.body;
  if (!full_name || !identity_card) {
    return res.status(400).json({ error: 'Họ tên và Số CCCD/CMND là bắt buộc' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Kiểm tra bệnh nhân đã tồn tại theo CCCD chưa (Hỗ trợ bệnh nhân tái khám)
    const existingPat = await client.query(`
      SELECT p.*, u.full_name, u.phone 
      FROM patients p 
      LEFT JOIN users u ON p.user_id = u.id 
      WHERE p.identity_card = $1
    `, [identity_card]);

    if (existingPat.rows.length > 0) {
      const pat = existingPat.rows[0];
      // Cập nhật thông tin nếu có thay đổi
      if (pat.user_id) {
        await client.query(`
          UPDATE users SET full_name = $1, phone = COALESCE(NULLIF($2, ''), phone) WHERE id = $3
        `, [full_name, phone || '', pat.user_id]);
      }
      await client.query(`
        UPDATE patients 
        SET dob = COALESCE(NULLIF($1, '')::date, dob), 
            gender = COALESCE(NULLIF($2, ''), gender),
            address = COALESCE(NULLIF($3, ''), address),
            medical_history = COALESCE(NULLIF($4, ''), medical_history)
        WHERE id = $5
      `, [dob || null, gender || '', address || '', medical_history || '', pat.id]);

      await client.query('COMMIT');
      return res.status(200).json({ ...pat, full_name, phone: phone || pat.phone });
    }

    // 2. Nếu là bệnh nhân mới: tạo user và profile bệnh nhân
    const username = 'pat_' + (identity_card || Date.now());
    const userRes = await client.query(`
      INSERT INTO users (username, password_hash, full_name, phone, role_id)
      VALUES ($1, 'scrypt:default', $2, $3, 4)
      RETURNING id
    `, [username, full_name, phone || '']);

    const userId = userRes.rows[0].id;

    // Tạo patient
    const patientRes = await client.query(`
      INSERT INTO patients (user_id, identity_card, dob, gender, address, medical_history)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [userId, identity_card, dob || '2000-01-01', gender || 'Nam', address || '', medical_history || '']);

    await client.query('COMMIT');
    res.status(201).json({ ...patientRes.rows[0], full_name, phone });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Lỗi thêm bệnh nhân: ' + err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 9. APPOINTMENTS & QUEUE (TIẾP NHẬN & CẤP SỐ)
// ==========================================
// Lấy danh sách các ngày có lịch khám bệnh phục vụ bộ lọc thời gian
app.get('/appointments/dates', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT to_char(appointment_date, 'YYYY-MM-DD') as date
      FROM appointments
      ORDER BY date DESC
    `);
    res.json(result.rows.map(r => r.date));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/appointments', async (req, res) => {
  const { date, status, doctor_id } = req.query;
  try {
    let query = `
      SELECT a.*, 
             u.full_name as patient_name, u.phone as patient_phone, p.identity_card, p.dob, p.gender,
             doc_u.full_name as doctor_name, d.room_number, dep.name as department_name
      FROM appointments a
      JOIN patients p ON a.patient_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN users doc_u ON d.user_id = doc_u.id
      LEFT JOIN departments dep ON d.department_id = dep.id
      WHERE 1=1
    `;
    const params = [];

    if (date) {
      if (date === 'all') {
        // Lấy tất cả các ngày trong lịch sử
      } else if (date === 'today') {
        query += ` AND (a.appointment_date = CURRENT_DATE OR a.status IN ('WAITING', 'IN_PROGRESS'))`;
      } else {
        params.push(date);
        query += ` AND a.appointment_date = $${params.length}`;
      }
    } else {
      // Mặc định ngày hôm nay hoặc các bệnh nhân đang chờ khám / đang khám
      query += ` AND (a.appointment_date = CURRENT_DATE OR a.status IN ('WAITING', 'IN_PROGRESS'))`;
    }

    if (status) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    if (doctor_id) {
      params.push(doctor_id);
      query += ` AND a.doctor_id = $${params.length}`;
    }

    query += ` ORDER BY a.appointment_date DESC, a.queue_number ASC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tiếp nhận bệnh nhân & tự động cấp số thứ tự (Sử dụng Redis Atomic Counter & Fallback DB)
app.post('/appointments', async (req, res) => {
  const { patient_id, doctor_id, symptoms } = req.body;
  if (!patient_id || !doctor_id) {
    return res.status(400).json({ error: 'Cần chọn bệnh nhân và bác sĩ' });
  }

  try {
    let nextQueue = null;

    // 1. Cấp số thứ tự nguyên tử (Atomic Counter) qua Redis nếu có kết nối
    if (redisConnected) {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        const redisKey = `clinic:queue_counter:${todayStr}`;
        const keyExists = await redis.exists(redisKey);

        if (!keyExists) {
          // Khởi tạo bộ đếm Redis từ số thứ tự lớn nhất trong DB
          const currentMaxRes = await pool.query(`
            SELECT COALESCE(MAX(queue_number), 0) as max_q
            FROM appointments
            WHERE appointment_date = CURRENT_DATE
          `);
          const currentMax = parseInt(currentMaxRes.rows[0].max_q, 10);
          await redis.set(redisKey, currentMax);
          await redis.expire(redisKey, 86400); // Hết hạn sau 24h
        }

        nextQueue = await redis.incr(redisKey);
      } catch (redisErr) {
        console.warn('[Redis] Lỗi tăng số thứ tự trên Redis, chuyển sang fallback DB:', redisErr.message);
      }
    }

    // 2. Fallback sang truy vấn PostgreSQL nếu Redis offline
    if (!nextQueue) {
      const maxQRes = await pool.query(`
        SELECT COALESCE(MAX(queue_number), 0) + 1 as next_queue
        FROM appointments
        WHERE appointment_date = CURRENT_DATE
      `);
      nextQueue = parseInt(maxQRes.rows[0].next_queue, 10);
    }

    const insertRes = await pool.query(`
      INSERT INTO appointments (queue_number, patient_id, doctor_id, appointment_date, status, symptoms)
      VALUES ($1, $2, $3, CURRENT_DATE, 'WAITING', $4)
      RETURNING *
    `, [nextQueue, patient_id, doctor_id, symptoms || '']);

    res.status(201).json(insertRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi cấp số tiếp nhận: ' + err.message });
  }
});

// Cập nhật trạng thái lượt khám (WAITING -> IN_PROGRESS -> COMPLETED)
app.patch('/appointments/:id/status', async (req, res) => {
  const { status } = req.body;
  const { id } = req.params;
  try {
    const result = await pool.query(`
      UPDATE appointments
      SET status = $1
      WHERE id = $2
      RETURNING *
    `, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy lượt khám với ID ' + id });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 10. CATALOGS: DỊCH VỤ CẬN LÂM SÀNG & THUỐC
// ==========================================
app.get('/medical-services', async (req, res) => {
  try {
    if (redisConnected) {
      try {
        const cached = await redis.get('clinic:cache:medical_services');
        if (cached) return res.json(JSON.parse(cached));
      } catch (cacheErr) {}
    }

    const result = await pool.query('SELECT * FROM medical_services ORDER BY id ASC');

    if (redisConnected) {
      try {
        await redis.setex('clinic:cache:medical_services', 300, JSON.stringify(result.rows));
      } catch (e) {}
    }

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/medicines', async (req, res) => {
  try {
    if (redisConnected) {
      try {
        const cached = await redis.get('clinic:cache:medicines');
        if (cached) return res.json(JSON.parse(cached));
      } catch (cacheErr) {}
    }

    const result = await pool.query('SELECT * FROM medicines ORDER BY id ASC');

    if (redisConnected) {
      try {
        await redis.setex('clinic:cache:medicines', 300, JSON.stringify(result.rows));
      } catch (e) {}
    }

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 11. MEDICAL RECORDS, PRESCRIPTIONS, SERVICES
// ==========================================
app.get('/medical-records/by-appointment/:appointmentId', async (req, res) => {
  const { appointmentId } = req.params;
  try {
    const recordRes = await pool.query(`
      SELECT * FROM medical_records WHERE appointment_id = $1
    `, [appointmentId]);

    if (recordRes.rows.length === 0) {
      return res.status(404).json({ error: 'Chưa có hồ sơ bệnh án cho lượt khám này' });
    }

    const record = recordRes.rows[0];

    const servicesRes = await pool.query(`
      SELECT sr.*, ms.name as service_name, ms.price, ms.service_code
      FROM service_requests sr
      JOIN medical_services ms ON sr.service_id = ms.id
      WHERE sr.record_id = $1
    `, [record.id]);

    const prescriptionsRes = await pool.query(`
      SELECT p.*, m.name as medicine_name, m.unit, m.unit_price
      FROM prescriptions p
      JOIN medicines m ON p.medicine_id = m.id
      WHERE p.record_id = $1
    `, [record.id]);

    res.json({
      record,
      services: servicesRes.rows,
      prescriptions: prescriptionsRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bác sĩ lưu kết quả khám bệnh, chỉ định CLS, kê đơn thuốc và tạo hóa đơn
app.post('/medical-records', async (req, res) => {
  const {
    appointment_id,
    temperature,
    blood_pressure,
    diagnosis,
    doctor_advice,
    services = [], // [{ service_id, result_text }]
    prescriptions = [] // [{ medicine_id, quantity, dosage_instructions }]
  } = req.body;

  if (!appointment_id || !diagnosis) {
    return res.status(400).json({ error: 'Mã lịch hẹn và Chẩn đoán là bắt buộc' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Tạo hoặc cập nhật medical_records
    const recordRes = await client.query(`
      INSERT INTO medical_records (appointment_id, temperature, blood_pressure, diagnosis, doctor_advice)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (appointment_id) 
      DO UPDATE SET
        temperature = EXCLUDED.temperature,
        blood_pressure = EXCLUDED.blood_pressure,
        diagnosis = EXCLUDED.diagnosis,
        doctor_advice = EXCLUDED.doctor_advice
      RETURNING id
    `, [appointment_id, temperature || 37.0, blood_pressure || '120/80', diagnosis, doctor_advice || '']);

    const recordId = recordRes.rows[0].id;

    // Làm sạch chỉ định và đơn thuốc cũ nếu lưu lại
    await client.query(`DELETE FROM service_requests WHERE record_id = $1`, [recordId]);
    await client.query(`DELETE FROM prescriptions WHERE record_id = $1`, [recordId]);

    // 2. Thêm chỉ định dịch vụ CLS
    let servicesTotal = 0;
    for (const s of services) {
      if (!s.service_id) continue;
      await client.query(`
        INSERT INTO service_requests (record_id, service_id, result_text, result_image_url, status)
        VALUES ($1, $2, $3, $4, 'COMPLETED')
      `, [recordId, s.service_id, s.result_text || 'Đã thực hiện', s.result_image_url || null]);

      const sPrice = await client.query('SELECT price FROM medical_services WHERE id = $1', [s.service_id]);
      if (sPrice.rows.length) servicesTotal += parseFloat(sPrice.rows[0].price);
    }

    // 3. Thêm đơn thuốc
    let medicinesTotal = 0;
    for (const p of prescriptions) {
      if (!p.medicine_id || !p.quantity) continue;
      await client.query(`
        INSERT INTO prescriptions (record_id, medicine_id, quantity, dosage_instructions)
        VALUES ($1, $2, $3, $4)
      `, [recordId, p.medicine_id, p.quantity, p.dosage_instructions || 'Uống theo chỉ định']);

      const mPrice = await client.query('SELECT unit_price FROM medicines WHERE id = $1', [p.medicine_id]);
      if (mPrice.rows.length) {
        medicinesTotal += parseFloat(mPrice.rows[0].unit_price) * parseInt(p.quantity, 10);
      }
    }

    // 4. Cập nhật trạng thái appointment sang COMPLETED
    await client.query(`UPDATE appointments SET status = 'COMPLETED' WHERE id = $1`, [appointment_id]);

    // 5. Tự động sinh hóa đơn (Tiền khám: 50,000 + dịch vụ CLS + tiền thuốc)
    const examFee = 50000;
    const totalAmount = examFee + servicesTotal + medicinesTotal;

    await client.query(`
      INSERT INTO invoices (appointment_id, total_amount, payment_status, payment_method)
      VALUES ($1, $2, 'UNPAID', 'CASH')
      ON CONFLICT (appointment_id)
      DO UPDATE SET total_amount = EXCLUDED.total_amount
    `, [appointment_id, totalAmount]);

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      record_id: recordId,
      total_amount: totalAmount,
      message: 'Lưu bệnh án, đơn thuốc và tạo hóa đơn thành công'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Lỗi lưu bệnh án: ' + err.message });
  } finally {
    client.release();
  }
});

// ==========================================
// 12. INVOICES & PAYMENT (HÓA ĐƠN & THU NGÂN)
// ==========================================
app.get('/invoices', async (req, res) => {
  try {
    const query = `
      SELECT i.*, 
             a.queue_number, a.appointment_date,
             u.full_name as patient_name, u.phone as patient_phone,
             doc_u.full_name as doctor_name
      FROM invoices i
      JOIN appointments a ON i.appointment_id = a.id
      JOIN patients p ON a.patient_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      LEFT JOIN users doc_u ON d.user_id = doc_u.id
      ORDER BY i.id DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Xác nhận thanh toán hóa đơn
app.post('/invoices/:id/pay', async (req, res) => {
  const { id } = req.params;
  const { payment_method = 'CASH' } = req.body;
  try {
    const result = await pool.query(`
      UPDATE invoices
      SET payment_status = 'PAID', payment_method = $1
      WHERE id = $2
      RETURNING *
    `, [payment_method, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy hóa đơn' });
    }

    res.json({ success: true, invoice: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 13. FILE UPLOAD (CHẨN ĐOÁN HÌNH ẢNH / X-QUANG)
// ==========================================
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Chưa có file tải lên' });
  }
  const fileUrl = `/static/uploads/${req.file.filename}`;
  res.json({
    success: true,
    file_name: req.file.filename,
    url: fileUrl
  });
});

// ==========================================
// 14. SERVER START
// ==========================================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`Clinic Management Backend API is running on port ${PORT}`);
  console.log(`- Health check: http://localhost:${PORT}/health`);
  console.log(`- Prometheus Metrics: http://localhost:${PORT}/metrics`);
  console.log(`=======================================================`);
});
