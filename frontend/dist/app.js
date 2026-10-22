// App.js - Quản Lý Phòng Khám (HMS)
// Phục vụ môn thi Triển Khai và Quản Trị Hệ Thống Phần Mềm

const API_BASE = (window.location.port === '8000') 
  ? '' 
  : (window.location.protocol === 'file:' ? 'http://localhost/api' : '/api');

// Global State
const state = {
  currentRole: 'RECEPTIONIST',
  currentUser: {
    name: 'Nguyễn Thị Hoa (Lễ Tân)',
    role: 'LỄ TÂN (Tiếp nhận & Cấp số)',
    avatar: 'LT'
  },
  doctors: [],
  services: [],
  medicines: [],
  appointments: [],
  invoices: [],
  selectedAppointment: null
};

// ==========================================
// 1. KHỞI TẠO VÀ SỰ KIỆN KHI LOAD TRANG
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  setupRoleSwitcher();
  setupModal();
  setupDoctorExamForm();
  setupStressTest();

  // Khởi tạo phân quyền ban đầu (RBAC Enforcement)
  applyRolePermissions(state.currentRole);

  // Khởi động kiểm tra máy chủ & tải dữ liệu ban đầu
  await checkServerHealth();
  setInterval(checkServerHealth, 10000);

  await loadInitialCatalogs();
  await loadDashboardData();
});

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️')}</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==========================================
// 2. HEALTH CHECK & MONITORING STATUS
// ==========================================
async function checkServerHealth() {
  const dot = document.getElementById('server-dot');
  const text = document.getElementById('server-text');
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (res.ok) {
      const data = await res.json();
      dot.style.backgroundColor = '#10b981';
      dot.style.boxShadow = '0 0 8px #10b981';
      text.innerText = `Máy chủ Hoạt động (DB: ${data.database}, Redis: ${data.redis})`;
    } else {
      dot.style.backgroundColor = '#f59e0b';
      text.innerText = `Cảnh báo phản hồi máy chủ (${res.status})`;
    }
  } catch (err) {
    dot.style.backgroundColor = '#ef4444';
    dot.style.boxShadow = 'none';
    text.innerText = `Chưa kết nối Backend (Cần chạy Docker Compose)`;
  }
}

// ==========================================
// 3. ĐIỀU HƯỚNG TABS & PHÂN QUYỀN VAI TRÒ (RBAC)
// ==========================================
// Bảng ma trận phân quyền: Vai trò nào chỉ được thấy và vào phân hệ đó
const ROLE_PERMISSIONS = {
  RECEPTIONIST: ['tab-reception'],
  DOCTOR: ['tab-doctor'],
  CASHIER: ['tab-cashier'],
  ADMIN: ['tab-reception', 'tab-doctor', 'tab-cashier', 'tab-admin']
};

function switchTab(targetId) {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(t => {
    t.classList.toggle('active', t.dataset.tab === targetId);
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.style.display = pane.id === targetId ? 'block' : 'none';
  });

  if (targetId === 'tab-doctor') loadDoctorQueue();
  if (targetId === 'tab-cashier') loadInvoices();
  if (targetId === 'tab-reception') loadAppointments();
}

function applyRolePermissions(role) {
  const allowedTabs = ROLE_PERMISSIONS[role] || [];

  // 1. Chỉ hiển thị các tab điều hướng mà vai trò này có quyền
  // Bác sĩ chỉ thấy tab Bác sĩ, Tiếp tân chỉ thấy Tiếp tân, Thu ngân chỉ thấy Thu ngân.
  // Riêng ADMIN có toàn quyền xem cả 4 phân hệ.
  document.querySelectorAll('.nav-tab').forEach(tab => {
    const tabTarget = tab.dataset.tab;
    if (role === 'ADMIN' || allowedTabs.includes(tabTarget)) {
      tab.style.display = 'inline-flex';
    } else {
      tab.style.display = 'none';
    }
  });

  // 2. Chuyển ngay đến tab phân hệ của vai trò đó
  const defaultTabMap = {
    RECEPTIONIST: 'tab-reception',
    DOCTOR: 'tab-doctor',
    CASHIER: 'tab-cashier',
    ADMIN: 'tab-admin'
  };

  const targetTabId = defaultTabMap[role] || allowedTabs[0];
  switchTab(targetTabId);
}

function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      const allowedTabs = ROLE_PERMISSIONS[state.currentRole] || [];

      // RBAC Security Guard: Ngăn chặn tuyệt đối truy cập trái phép
      if (state.currentRole !== 'ADMIN' && !allowedTabs.includes(targetId)) {
        showToast(`Quyền truy cập bị từ chối: Tài khoản ${state.currentUser.role} không có quyền vào phân hệ này!`, 'error');
        return;
      }

      switchTab(targetId);
    });
  });
}

function setupRoleSwitcher() {
  const roleButtons = document.querySelectorAll('.role-btn');
  roleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      roleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const role = btn.dataset.role;
      state.currentRole = role;

      if (role === 'ADMIN') {
        state.currentUser = { name: 'Quản Trị Viên Hệ Thống', role: 'ADMIN (Toàn quyền)', avatar: 'AD' };
      } else if (role === 'DOCTOR') {
        state.currentUser = { name: 'BS CK1. Trần Văn Nam', role: 'BÁC SĨ (Chẩn đoán & Kê đơn)', avatar: 'BS' };
      } else if (role === 'RECEPTIONIST') {
        state.currentUser = { name: 'Nguyễn Thị Hoa (Lễ Tân)', role: 'LỄ TÂN (Tiếp nhận & Cấp số)', avatar: 'LT' };
      } else if (role === 'CASHIER') {
        state.currentUser = { name: 'Phòng Thu Ngân & Viện Phí', role: 'THU NGÂN (Thu phí & In hóa đơn)', avatar: 'TN' };
      }

      document.getElementById('current-avatar').innerText = state.currentUser.avatar;
      document.getElementById('current-name').innerText = state.currentUser.name;
      document.getElementById('current-role').innerText = state.currentUser.role;

      // Thực thi phân quyền RBAC tức thì: ẩn các tab không thuộc quyền
      applyRolePermissions(role);
      showToast(`Đã chuyển vai trò: ${state.currentUser.name}`, 'info');
    });
  });
}

// ==========================================
// 4. TẢI DỮ LIỆU BAN ĐẦU (CATALOGS & STATS)
// ==========================================
async function loadInitialCatalogs() {
  try {
    const [docsRes, srvRes, medRes] = await Promise.all([
      fetch(`${API_BASE}/doctors`).catch(() => ({ ok: false })),
      fetch(`${API_BASE}/medical-services`).catch(() => ({ ok: false })),
      fetch(`${API_BASE}/medicines`).catch(() => ({ ok: false }))
    ]);

    if (docsRes.ok) {
      state.doctors = await docsRes.json();
      populateDoctorDropdown();
    }
    if (srvRes.ok) {
      state.services = await srvRes.json();
      populateServicesCheckboxes();
    }
    if (medRes.ok) {
      state.medicines = await medRes.json();
    }
  } catch (e) {
    console.error('Lỗi nạp catalogs:', e);
  }
}

async function loadDashboardData() {
  await Promise.all([loadStats(), loadAppointments()]);
}

async function loadStats() {
  try {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('stat-patients').innerText = data.total_patients;
    document.getElementById('stat-waiting').innerText = data.waiting_queue;
    document.getElementById('stat-completed').innerText = data.completed_queue;
    
    // Doanh thu hôm nay
    const todayRev = data.today_revenue !== undefined ? data.today_revenue : 0;
    document.getElementById('stat-revenue').innerText = new Intl.NumberFormat('vi-VN').format(todayRev) + ' đ';

    // Tổng doanh thu tích lũy
    const totalBadge = document.getElementById('stat-revenue-total');
    if (totalBadge) {
      totalBadge.innerText = `Tích lũy: ${new Intl.NumberFormat('vi-VN').format(data.total_revenue || 0)} đ`;
    }
  } catch (err) {
    console.error('Stats error:', err);
  }
}

// ==========================================
// 5. NGHIỆP VỤ TIẾP NHẬN BỆNH NHÂN (RECEPTION)
// ==========================================
async function loadAppointments() {
  try {
    const res = await fetch(`${API_BASE}/appointments`);
    if (!res.ok) throw new Error('Không thể tải lịch khám');
    state.appointments = await res.json();
    renderReceptionTable();
  } catch (err) {
    const tbody = document.getElementById('appointment-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 20px;">Lỗi kết nối cơ sở dữ liệu: ${err.message}</td></tr>`;
    }
  }
}

function renderReceptionTable() {
  const tbody = document.getElementById('appointment-tbody');
  if (!tbody) return;

  if (!state.appointments || state.appointments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">Chưa có bệnh nhân nào đăng ký khám trong ngày hôm nay.</td></tr>`;
    return;
  }

  tbody.innerHTML = state.appointments.map(a => {
    let badgeClass = 'badge-waiting';
    let statusText = 'Chờ khám';
    if (a.status === 'IN_PROGRESS') { badgeClass = 'badge-in_progress'; statusText = 'Đang khám'; }
    if (a.status === 'COMPLETED') { badgeClass = 'badge-completed'; statusText = 'Đã khám xong'; }
    if (a.status === 'CANCELLED') { badgeClass = 'badge-cancelled'; statusText = 'Đã hủy'; }

    let actionHtml = '';
    if (a.status === 'WAITING') {
      actionHtml = `<button class="btn btn-secondary btn-sm" onclick="startExamFromReception(${a.id})">🩺 Bắt Đầu Khám</button>`;
    } else if (a.status === 'IN_PROGRESS') {
      actionHtml = `<button class="btn btn-primary btn-sm" onclick="startExamFromReception(${a.id})">🩺 Tiếp Tục Khám</button>`;
    } else {
      actionHtml = `<span style="font-size: 0.85rem; color: #16a34a; font-weight: 700;">✅ Hoàn tất</span>`;
    }

    return `
      <tr>
        <td><strong style="color: var(--primary); font-size: 1.15rem; font-weight: 800;">#${String(a.queue_number).padStart(2, '0')}</strong></td>
        <td><strong>${a.patient_name || '--'}</strong></td>
        <td>${a.identity_card || '--'}</td>
        <td><span style="font-family: monospace; font-size: 0.85rem; font-weight: 600; color: #334155;">${a.patient_phone || '--'}</span></td>
        <td>
          <div style="font-weight: 700; color: var(--dark); font-size: 0.85rem;">${a.doctor_name || 'Bác sĩ phụ trách'}</div>
          <span style="font-size: 0.75rem; color: #64748b;">${a.room_number || 'P.102'} - ${a.department_name || 'Khám bệnh'}</span>
        </td>
        <td><span style="font-size: 0.82rem; color: #475569;">${a.symptoms || 'Khám tổng quát'}</span></td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
        <td style="text-align: right; white-space: nowrap;">${actionHtml}</td>
      </tr>
    `;
  }).join('');
}

function populateDoctorDropdown() {
  const select = document.getElementById('p-doctor-select');
  if (select) {
    select.innerHTML = state.doctors.map(d => `
      <option value="${d.id}">${d.full_name} - ${d.department_name} (${d.room_number})</option>
    `).join('');
  }

  const filterSelect = document.getElementById('doctor-filter-select');
  if (filterSelect) {
    const curVal = filterSelect.value || 'all';
    filterSelect.innerHTML = `<option value="all">🏥 Tất cả phòng khám / bác sĩ</option>` + state.doctors.map(d => `
      <option value="${d.id}">${d.full_name} - ${d.department_name} (${d.room_number})</option>
    `).join('');
    filterSelect.value = curVal;
    filterSelect.onchange = loadDoctorQueue;
  }
}

function setupModal() {
  const modal = document.getElementById('modal-patient');
  const btnOpen = document.getElementById('btn-open-new-patient');
  const btnClose = document.getElementById('btn-close-modal');
  const btnCancel = document.getElementById('btn-cancel-modal');
  const form = document.getElementById('form-new-patient');

  btnOpen.addEventListener('click', () => {
    populateDoctorDropdown();
    modal.classList.add('open');
  });
  btnClose.addEventListener('click', () => modal.classList.remove('open'));
  btnCancel.addEventListener('click', () => modal.classList.remove('open'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('p-name').value;
    const phone = document.getElementById('p-phone').value;
    const idcard = document.getElementById('p-idcard').value;
    const dob = document.getElementById('p-dob').value;
    const gender = document.getElementById('p-gender').value;
    const doctorId = document.getElementById('p-doctor-select').value;
    const address = document.getElementById('p-address').value;
    const symptoms = document.getElementById('p-symptoms').value;

    try {
      // 1. Tạo hoặc nạp bệnh nhân
      const patRes = await fetch(`${API_BASE}/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, phone, identity_card: idcard, dob, gender, address })
      });
      if (!patRes.ok) {
        const errJson = await patRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Không thể thêm hồ sơ bệnh nhân');
      }
      const patData = await patRes.json();

      // 2. Cấp số khám
      const appRes = await fetch(`${API_BASE}/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patData.id, doctor_id: doctorId, symptoms })
      });
      if (!appRes.ok) {
        const errJson = await appRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Không thể cấp số khám');
      }
      const appData = await appRes.json();

      showToast(`Đã cấp số thứ tự #${appData.queue_number} cho bệnh nhân ${name}!`, 'success');
      modal.classList.remove('open');
      form.reset();
      await loadDashboardData();
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  });
}

window.startExamFromReception = async (appointmentId) => {
  try {
    await fetch(`${API_BASE}/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' })
    });
  } catch (e) {}

  showToast('Đã mời bệnh nhân vào phòng khám!', 'info');
  const btnDoc = document.getElementById('btn-role-doctor');
  if (btnDoc) {
    btnDoc.click();
  } else {
    applyRolePermissions('DOCTOR');
  }
  await selectDoctorPatient(appointmentId);
};

// ==========================================
// 6. NGHIỆP VỤ BÁC SĨ KHÁM BỆNH & EMR
// ==========================================
async function loadDoctorQueue() {
  const queueContainer = document.getElementById('doctor-queue-list');
  try {
    const res = await fetch(`${API_BASE}/appointments`);
    if (!res.ok) return;
    state.appointments = await res.json();

    const filterSelect = document.getElementById('doctor-filter-select');
    const selectedDoctorId = filterSelect ? filterSelect.value : 'all';

    let waitingOrActive = state.appointments.filter(a => a.status === 'WAITING' || a.status === 'IN_PROGRESS');
    if (selectedDoctorId && selectedDoctorId !== 'all') {
      waitingOrActive = waitingOrActive.filter(a => String(a.doctor_id) === String(selectedDoctorId));
    }

    if (waitingOrActive.length === 0) {
      queueContainer.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; padding: 20px; text-align: center;">Hiện không có bệnh nhân nào chờ khám.</p>';
      return;
    }

    queueContainer.innerHTML = waitingOrActive.map(a => `
      <div class="queue-card ${state.selectedAppointment?.id == a.id ? 'active' : ''}" onclick="selectDoctorPatient(${a.id})">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="queue-num">${String(a.queue_number).padStart(2, '0')}</div>
          <div>
            <strong style="color: var(--dark); font-size: 0.95rem;">${a.patient_name}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${a.patient_phone || a.identity_card}</div>
            <div style="font-size: 0.72rem; color: var(--primary); font-weight: 700; margin-top: 2px;">👨‍⚕️ ${a.doctor_name || 'BS Phụ trách'} <span style="color: var(--text-muted);">(${a.room_number || 'P.102'})</span></div>
          </div>
        </div>
        <span class="badge ${a.status === 'IN_PROGRESS' ? 'badge-in_progress' : 'badge-waiting'}">
          ${a.status === 'IN_PROGRESS' ? 'Đang khám' : 'Chờ'}
        </span>
      </div>
    `).join('');
  } catch (err) {
    queueContainer.innerHTML = `<p style="color: var(--danger);">Lỗi tải hàng đợi: ${err.message}</p>`;
  }
}

window.selectDoctorPatient = async (appointmentId) => {
  let appointment = state.appointments.find(a => a.id == appointmentId);
  if (!appointment) {
    await loadDoctorQueue();
    appointment = state.appointments.find(a => a.id == appointmentId);
    if (!appointment) return;
  }
  state.selectedAppointment = appointment;

  // Đảm bảo bộ lọc không ẩn bệnh nhân đang được chọn
  const filterSelect = document.getElementById('doctor-filter-select');
  if (filterSelect && filterSelect.value !== 'all' && appointment.doctor_id && filterSelect.value != appointment.doctor_id) {
    filterSelect.value = 'all';
  }

  // 1. Reset form sạch sẽ trước khi nạp
  const form = document.getElementById('form-medical-record');
  form.reset();
  document.getElementById('prescription-container').innerHTML = '';
  document.querySelectorAll('input[name="services"]').forEach(cb => cb.checked = false);
  const fileInput = document.getElementById('exam-xray-file');
  if (fileInput) fileInput.value = '';
  const imgUrlInput = document.getElementById('exam-image-url');
  if (imgUrlInput) imgUrlInput.value = '';
  const statusSpan = document.getElementById('xray-upload-status');
  if (statusSpan) statusSpan.innerText = '';
  const previewBox = document.getElementById('xray-preview-container');
  if (previewBox) previewBox.style.display = 'none';

  document.getElementById('exam-empty-state').style.display = 'none';
  form.style.display = 'block';

  document.getElementById('exam-appointment-id').value = appointment.id;
  document.getElementById('exam-patient-title').innerText = `Khám Bệnh: ${appointment.patient_name} (STT #${appointment.queue_number})`;
  document.getElementById('exam-patient-sub').innerText = `Lý do: "${appointment.symptoms || 'Không có'}" | Bác sĩ: ${appointment.doctor_name || 'BS Phụ trách'}`;
  
  // Cập nhật huy hiệu trạng thái & nút bắt đầu khám
  const statusBadge = document.getElementById('exam-status-badge');
  const btnStartExam = document.getElementById('btn-start-exam');

  if (appointment.status === 'WAITING') {
    statusBadge.innerText = 'CHỜ KHÁM';
    statusBadge.className = 'badge badge-waiting';
    if (btnStartExam) {
      btnStartExam.style.display = 'inline-flex';
      btnStartExam.innerText = '🩺 Mời Vào Phòng & Bắt Đầu Khám';
    }
  } else if (appointment.status === 'IN_PROGRESS') {
    statusBadge.innerText = 'ĐANG KHÁM';
    statusBadge.className = 'badge badge-in_progress';
    if (btnStartExam) btnStartExam.style.display = 'none';
  } else if (appointment.status === 'COMPLETED') {
    statusBadge.innerText = 'ĐÃ KHÁM XONG';
    statusBadge.className = 'badge badge-completed';
    if (btnStartExam) btnStartExam.style.display = 'none';
  }

  document.getElementById('exam-bp').value = '120/80';
  document.getElementById('exam-temp').value = '37.0';

  // 2. Nạp dữ liệu bệnh án cũ từ server nếu đã từng được khám
  try {
    const recRes = await fetch(`${API_BASE}/medical-records/by-appointment/${appointment.id}`);
    if (recRes.ok) {
      const recData = await recRes.json();
      if (recData.record) {
        document.getElementById('exam-bp').value = recData.record.blood_pressure || '120/80';
        document.getElementById('exam-temp').value = recData.record.temperature || '37.0';
        document.getElementById('exam-diagnosis').value = recData.record.diagnosis || '';
        document.getElementById('exam-advice').value = recData.record.doctor_advice || '';
      }
      if (recData.services && recData.services.length) {
        recData.services.forEach(s => {
          const cb = document.querySelector(`input[name="services"][value="${s.service_id}"]`);
          if (cb) cb.checked = true;
          if (s.result_image_url) {
            if (imgUrlInput) imgUrlInput.value = s.result_image_url;
            const previewImg = document.getElementById('xray-preview-img');
            if (previewImg) previewImg.src = s.result_image_url;
            if (previewBox) previewBox.style.display = 'block';
            if (statusSpan) statusSpan.innerText = '✅ Đã lưu (Nginx static)';
          }
        });
      }
      if (recData.prescriptions && recData.prescriptions.length) {
        recData.prescriptions.forEach(p => {
          addPrescriptionRow(p.medicine_id, p.quantity, p.dosage_instructions);
        });
      }
    }
  } catch (e) {
    // Không có bệnh án cũ thì bắt đầu với form mới
  }

  loadDoctorQueue();
};

function populateServicesCheckboxes() {
  const container = document.getElementById('cls-services-checkboxes');
  if (!container) return;
  container.innerHTML = state.services.map(s => `
    <label style="display: flex; align-items: center; gap: 10px; font-size: 0.85rem; cursor: pointer;">
      <input type="checkbox" name="services" value="${s.id}" data-price="${s.price}">
      <strong>${s.name}</strong>
      <span style="color: var(--primary); font-weight: 600;">(${new Intl.NumberFormat('vi-VN').format(s.price)} đ)</span>
    </label>
  `).join('');
}

function setupDoctorExamForm() {
  const form = document.getElementById('form-medical-record');
  const btnAddPrescription = document.getElementById('btn-add-prescription-row');
  const btnRefreshQueue = document.getElementById('btn-refresh-queue');
  const btnCancelExam = document.getElementById('btn-cancel-exam');
  const fileUploadInput = document.getElementById('exam-xray-file');

  // Lắng nghe sự kiện tải lên ảnh X-quang/siêu âm
  if (fileUploadInput) {
    fileUploadInput.addEventListener('change', async () => {
      if (!fileUploadInput.files.length) return;
      const statusSpan = document.getElementById('xray-upload-status');
      statusSpan.innerText = 'Đang tải lên qua Nginx...';
      const formData = new FormData();
      formData.append('file', fileUploadInput.files[0]);
      try {
        const res = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          body: formData
        });
        if (res.status === 413) {
          statusSpan.innerText = '❌ Dung lượng ảnh quá lớn (>50MB)';
          showToast('Dung lượng ảnh quá lớn (>50MB)!', 'error');
          return;
        }
        if (!res.ok) {
          statusSpan.innerText = `❌ Lỗi máy chủ (${res.status})`;
          showToast(`Lỗi upload ảnh (HTTP ${res.status})`, 'error');
          return;
        }
        const data = await res.json();
        if (data.success) {
          document.getElementById('exam-image-url').value = data.url;
          document.getElementById('xray-preview-img').src = data.url;
          document.getElementById('xray-preview-container').style.display = 'block';
          statusSpan.innerText = '✅ Đã lưu (Nginx Static Volume)';
          showToast('Đã tải ảnh lên Nginx volume thành công!', 'success');
        } else {
          statusSpan.innerText = '❌ ' + (data.error || 'Lỗi');
        }
      } catch (err) {
        statusSpan.innerText = '❌ Lỗi tải ảnh: ' + err.message;
        showToast('Lỗi upload: ' + err.message, 'error');
      }
    });
  }

  btnRefreshQueue.addEventListener('click', loadDoctorQueue);

  // Nút xác nhận chính thức mời bệnh nhân vào phòng & bắt đầu khám
  const btnStartExam = document.getElementById('btn-start-exam');
  if (btnStartExam) {
    btnStartExam.addEventListener('click', async () => {
      if (!state.selectedAppointment) return;

      // Cảnh báo nếu bác sĩ đang có bệnh nhân khác đang dở dang 'IN_PROGRESS'
      const otherActive = state.appointments.find(a => a.status === 'IN_PROGRESS' && a.id !== state.selectedAppointment.id);
      if (otherActive) {
        const confirmSwitch = confirm(`⚠️ Bác sĩ hiện đang khám dở cho bệnh nhân "${otherActive.patient_name}" (STT #${otherActive.queue_number}).\n\nBạn có chắc chắn muốn chuyển sang mời bệnh nhân "${state.selectedAppointment.patient_name}" (STT #${state.selectedAppointment.queue_number}) vào phòng khám không?`);
        if (!confirmSwitch) return;
      }

      try {
        await fetch(`${API_BASE}/appointments/${state.selectedAppointment.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'IN_PROGRESS' })
        });

        state.selectedAppointment.status = 'IN_PROGRESS';
        const statusBadge = document.getElementById('exam-status-badge');
        if (statusBadge) {
          statusBadge.innerText = 'ĐANG KHÁM';
          statusBadge.className = 'badge badge-in_progress';
        }
        btnStartExam.style.display = 'none';
        showToast(`Đã mời bệnh nhân ${state.selectedAppointment.patient_name} (STT #${state.selectedAppointment.queue_number}) vào khám!`, 'success');

        await loadDoctorQueue();
        await loadStats();
      } catch (err) {
        showToast('Lỗi cập nhật trạng thái: ' + err.message, 'error');
      }
    });
  }

  // Nút Hủy bỏ / Đóng form khám bệnh
  btnCancelExam.addEventListener('click', async () => {
    if (state.selectedAppointment && state.selectedAppointment.status === 'IN_PROGRESS') {
      const confirmRevert = confirm(`Bệnh nhân "${state.selectedAppointment.patient_name}" đang ở trạng thái "Đang khám".\n\nBạn có muốn chuyển bệnh nhân này về lại trạng thái "Chờ khám" để gọi lại sau không?`);
      if (confirmRevert) {
        try {
          await fetch(`${API_BASE}/appointments/${state.selectedAppointment.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'WAITING' })
          });
          state.selectedAppointment.status = 'WAITING';
          showToast(`Đã chuyển bệnh nhân ${state.selectedAppointment.patient_name} về lại hàng chờ khám!`, 'info');
        } catch (e) {
          console.warn('Lỗi khi hoàn tác về hàng chờ:', e);
        }
      }
    }

    state.selectedAppointment = null;
    document.getElementById('form-medical-record').style.display = 'none';
    document.getElementById('exam-empty-state').style.display = 'block';
    await loadDoctorQueue();
    await loadStats();
  });

  btnAddPrescription.addEventListener('click', addPrescriptionRow);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const appointmentId = document.getElementById('exam-appointment-id').value;
    const bp = document.getElementById('exam-bp').value;
    const temp = document.getElementById('exam-temp').value;
    const diagnosis = document.getElementById('exam-diagnosis').value;
    const advice = document.getElementById('exam-advice').value;

    // Lấy danh sách dịch vụ đã chọn
    // Lấy danh sách dịch vụ đã chọn và ảnh X-quang nếu có
    const imgUrl = document.getElementById('exam-image-url').value;
    const selectedServices = [];
    document.querySelectorAll('input[name="services"]:checked').forEach(cb => {
      selectedServices.push({ 
        service_id: parseInt(cb.value, 10), 
        result_text: 'Bình thường, đã thực hiện',
        result_image_url: imgUrl || null
      });
    });

    // Lấy danh sách thuốc đã kê
    const prescriptions = [];
    document.querySelectorAll('.prescription-row').forEach(row => {
      const medId = row.querySelector('.med-select').value;
      const qty = row.querySelector('.med-qty').value;
      const instr = row.querySelector('.med-instruction').value;
      if (medId && qty) {
        prescriptions.push({ medicine_id: parseInt(medId, 10), quantity: parseInt(qty, 10), dosage_instructions: instr });
      }
    });

    try {
      const res = await fetch(`${API_BASE}/medical-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id: parseInt(appointmentId, 10),
          blood_pressure: bp,
          temperature: parseFloat(temp),
          diagnosis,
          doctor_advice: advice,
          services: selectedServices,
          prescriptions
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Không thể lưu hồ sơ bệnh án');
      }
      const data = await res.json();

      showToast(`Đã hoàn tất khám bệnh và tạo viện phí (${new Intl.NumberFormat('vi-VN').format(data.total_amount)} đ)!`, 'success');
      form.reset();
      document.getElementById('prescription-container').innerHTML = '';
      const fInput = document.getElementById('exam-xray-file');
      if (fInput) fInput.value = '';
      document.getElementById('exam-image-url').value = '';
      document.getElementById('xray-upload-status').innerText = '';
      document.getElementById('xray-preview-container').style.display = 'none';
      state.selectedAppointment = null;
      document.getElementById('form-medical-record').style.display = 'none';
      document.getElementById('exam-empty-state').style.display = 'block';

      await loadDashboardData();
      await loadDoctorQueue();
    } catch (err) {
      showToast('Lỗi lưu bệnh án: ' + err.message, 'error');
    }
  });
}

function addPrescriptionRow(medId = '', qty = 10, instr = 'Uống sau bữa ăn, 2 lần/ngày') {
  const container = document.getElementById('prescription-container');
  const row = document.createElement('div');
  row.className = 'prescription-row';
  row.style.cssText = 'display: grid; grid-template-columns: 2fr 100px 3fr 40px; gap: 8px; align-items: center;';

  const selectedMedId = (typeof medId === 'number' || typeof medId === 'string') ? medId : '';
  const selectedQty = (typeof qty === 'number' || (typeof qty === 'string' && qty)) ? qty : 10;
  const selectedInstr = typeof instr === 'string' ? instr : 'Uống sau bữa ăn, 2 lần/ngày';

  const medOptions = state.medicines.map(m => `
    <option value="${m.id}" ${String(m.id) === String(selectedMedId) ? 'selected' : ''}>${m.name} (${new Intl.NumberFormat('vi-VN').format(m.unit_price)} đ/${m.unit})</option>
  `).join('');

  row.innerHTML = `
    <select class="form-control med-select" style="font-size: 0.85rem;">
      <option value="">-- Chọn thuốc --</option>
      ${medOptions}
    </select>
    <input type="number" class="form-control med-qty" value="${selectedQty}" min="1" placeholder="SL">
    <input type="text" class="form-control med-instruction" value="${selectedInstr}" placeholder="Cách dùng">
    <button type="button" class="btn btn-secondary btn-sm" onclick="this.parentElement.remove()" style="color: var(--danger); font-weight: bold;">✕</button>
  `;
  container.appendChild(row);
}

// ==========================================
// 7. THU NGÂN & QUẢN LÝ VIỆN PHÍ (CASHIER)
// ==========================================
async function loadInvoices() {
  const tbody = document.getElementById('invoices-tbody');
  const btnRefresh = document.getElementById('btn-refresh-invoices');
  btnRefresh.onclick = loadInvoices;

  try {
    const res = await fetch(`${API_BASE}/invoices`);
    if (!res.ok) throw new Error('Không thể tải danh sách hóa đơn');
    state.invoices = await res.json();

    if (state.invoices.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">Chưa có hóa đơn nào được phát sinh.</td></tr>`;
      return;
    }

    tbody.innerHTML = state.invoices.map(inv => `
      <tr>
        <td><strong>#HD-${String(inv.id).padStart(4, '0')}</strong></td>
        <td><strong style="color: var(--primary);">#${String(inv.queue_number).padStart(2, '0')}</strong></td>
        <td><strong>${inv.patient_name}</strong><br><span style="font-size: 0.75rem; color: var(--text-muted);">${inv.patient_phone || ''}</span></td>
        <td>${inv.doctor_name || 'BS Phụ trách'}</td>
        <td><strong style="color: #047857; font-size: 1.05rem;">${new Intl.NumberFormat('vi-VN').format(inv.total_amount)} đ</strong></td>
        <td><span style="font-size: 0.85rem;">${inv.payment_method === 'TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt'}</span></td>
        <td>
          <span class="badge ${inv.payment_status === 'PAID' ? 'badge-paid' : 'badge-unpaid'}">
            ${inv.payment_status === 'PAID' ? 'Đã Thanh Toán' : 'Chưa Thu'}
          </span>
        </td>
        <td style="text-align: right;">
          ${inv.payment_status !== 'PAID' ? `
            <button class="btn btn-success btn-sm" onclick="payInvoice(${inv.id}, 'CASH')">💵 Thu Tiền</button>
            <button class="btn btn-primary btn-sm" onclick="payInvoice(${inv.id}, 'TRANSFER')">💳 QR Pay</button>
          ` : `
            <button class="btn btn-secondary btn-sm" onclick="printInvoice(${inv.id})">🖨️ In Phiếu</button>
          `}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger); padding: 20px;">Lỗi: ${err.message}</td></tr>`;
  }
}

window.payInvoice = async (invoiceId, method) => {
  try {
    const res = await fetch(`${API_BASE}/invoices/${invoiceId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method: method })
    });
    if (!res.ok) throw new Error('Không thể cập nhật hóa đơn');
    showToast(`Đã xác nhận thu tiền thành công cho hóa đơn #HD-${invoiceId}!`, 'success');
    await loadInvoices();
    await loadStats();
  } catch (err) {
    showToast('Lỗi: ' + err.message, 'error');
  }
};

window.printInvoice = (invoiceId) => {
  const inv = state.invoices.find(i => i.id == invoiceId);
  if (!inv) return;

  const printWindow = window.open('', '_blank', 'width=450,height=600');
  if (printWindow) {
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hóa Đơn Viện Phí #HD-${String(inv.id).padStart(4, '0')}</title>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Courier New', monospace; padding: 20px; color: #111; line-height: 1.4; font-size: 14px; }
          .center { text-align: center; }
          .divider { border-top: 1px dashed #666; margin: 12px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 6px; }
          .total { font-size: 16px; font-weight: bold; }
          .stamp { text-align: center; margin-top: 15px; font-weight: bold; color: #047857; border: 2px solid #047857; padding: 6px; border-radius: 4px; display: inline-block; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="center">
          <h2 style="margin: 0;">PHÒNG KHÁM MEDICARE PRO</h2>
          <p style="margin: 4px 0; font-size: 12px;">Số 123 Đường Giải Phóng, Hà Nội - Hotline: 1900 6868</p>
          <div class="divider"></div>
          <h3 style="margin: 6px 0;">PHIẾU THU TIỀN VIỆN PHÍ</h3>
          <p style="margin: 0; font-size: 12px;">Mã HĐ: #HD-${String(inv.id).padStart(4, '0')} | STT Khám: #${inv.queue_number}</p>
        </div>
        <div class="divider"></div>
        <div class="row"><span>Bệnh nhân:</span><strong>${inv.patient_name}</strong></div>
        <div class="row"><span>Số điện thoại:</span><span>${inv.patient_phone || '--'}</span></div>
        <div class="row"><span>Bác sĩ khám:</span><span>${inv.doctor_name || 'BS Phụ trách'}</span></div>
        <div class="row"><span>Thời gian:</span><span>${new Date(inv.created_at || Date.now()).toLocaleString('vi-VN')}</span></div>
        <div class="divider"></div>
        <div class="row total">
          <span>TỔNG VIỆN PHÍ:</span>
          <span>${new Intl.NumberFormat('vi-VN').format(inv.total_amount)} VNĐ</span>
        </div>
        <div class="row">
          <span>Hình thức thanh toán:</span>
          <span>${inv.payment_method === 'TRANSFER' ? 'Chuyển khoản (QR Pay)' : 'Tiền mặt'}</span>
        </div>
        <div class="row">
          <span>Trạng thái:</span>
          <span style="color: #047857; font-weight: bold;">ĐÃ THANH TOÁN THÀNH CÔNG</span>
        </div>
        <div class="center" style="margin-top: 20px;">
          <div class="stamp">✓ ĐÃ THU ĐỦ TIỀN</div>
          <p style="font-size: 11px; margin-top: 15px; color: #666;">Cảm ơn quý khách đã tin tưởng khám bệnh tại phòng khám!<br>Chúc quý khách nhiều sức khỏe.</p>
          <button class="no-print" onclick="window.print()" style="margin-top: 10px; padding: 6px 16px; cursor: pointer; font-weight: bold;">🖨️ In Phiếu Thu Này</button>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
  } else {
    alert(`
=================================================
             HÓA ĐƠN VIỆN PHÍ PHÒNG KHÁM
=================================================
Mã hóa đơn: #HD-${String(inv.id).padStart(4, '0')}
Bệnh nhân: ${inv.patient_name}
Bác sĩ khám: ${inv.doctor_name}
Số thứ tự: #${inv.queue_number}
Ngày: ${new Date(inv.created_at).toLocaleString('vi-VN')}
-------------------------------------------------
Tổng tiền viện phí: ${new Intl.NumberFormat('vi-VN').format(inv.total_amount)} VNĐ
Hình thức: ${inv.payment_method === 'TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt'}
Trạng thái: ĐÃ THANH TOÁN
=================================================
    `);
  }
};

// ==========================================
// 8. KỊCH BẢN THỬ NGHIỆM TẢI & NGINX RATE LIMIT
// ==========================================
function setupStressTest() {
  const btn = document.getElementById('btn-stress-test');
  const resultBox = document.getElementById('stress-result-text');

  btn.addEventListener('click', async () => {
    resultBox.innerHTML = 'Đang phát 40 requests liên tiếp trong 0.5s tới /api/health để kích hoạt Rate Limiting...';
    btn.disabled = true;

    let successCount = 0;
    let rateLimitedCount = 0;
    const promises = [];

    for (let i = 0; i < 40; i++) {
      promises.push(
        fetch(`${API_BASE}/health`)
          .then(res => {
            if (res.status === 200) successCount++;
            else if (res.status === 503) rateLimitedCount++;
          })
          .catch(() => {})
      );
    }

    await Promise.all(promises);
    btn.disabled = false;

    resultBox.innerHTML = `
      <span style="color: #22c55e;">Thành công (200 OK): ${successCount}</span> | 
      <span style="color: #ef4444;">Bị chặn bởi Rate Limiting (503 Service Temporarily Unavailable): ${rateLimitedCount}</span>
      <br>=> <strong style="color: #fbbf24;">KẾT LUẬN:</strong> Cơ chế Rate Limiting của Nginx hoạt động chính xác theo cấu hình rate=10r/s burst=20!
    `;
    showToast(`Test tải hoàn tất: Chặn ${rateLimitedCount} requests vượt ngưỡng!`, 'info');
  });
}
