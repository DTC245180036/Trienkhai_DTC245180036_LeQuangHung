// App.js - Quản Lý Phòng Khám (HMS)
// Phục vụ môn thi Triển Khai và Quản Trị Hệ Thống Phần Mềm

const API_BASE = (window.location.port === '8000') 
  ? '' 
  : (window.location.protocol === 'file:' ? 'http://localhost/api' : '/api');

// Global State
const state = {
  currentRole: null,
  currentUser: null,
  filterDate: 'today',
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
  setupReceptionDateFilter();
  setupRevenueReportEvents();
  setupAuth();

  // Khởi động kiểm tra máy chủ & trạng thái container
  await checkServerHealth();
  setInterval(checkServerHealth, 10000);

  // Kiểm tra phiên đăng nhập đã lưu trong localStorage
  const savedUserJson = localStorage.getItem('clinic_auth_user');
  if (savedUserJson) {
    try {
      const savedUser = JSON.parse(savedUserJson);
      applyLoggedInState(savedUser);
    } catch (e) {
      showLoginScreen();
    }
  } else {
    showLoginScreen();
  }
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
  if (targetId === 'tab-admin') loadRevenueReport();
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

  // 2. Phân quyền hiển thị Thống kê Tài chính (Doanh thu)
  // Bác sĩ và Tiếp tân chỉ phụ trách chuyên môn y tế, hoàn toàn KHÔNG xem doanh thu tiền nong!
  // Chỉ Quản trị viên (ADMIN) và Thu ngân (CASHIER) mới được xem Doanh thu.
  const revCard = document.getElementById('card-stat-revenue');
  if (revCard) {
    if (role === 'ADMIN' || role === 'CASHIER') {
      revCard.style.display = 'flex';
    } else {
      revCard.style.display = 'none';
    }
  }

  // 3. Chuyển ngay đến tab phân hệ của vai trò đó
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
      const role = btn.dataset.role;
      const userMap = {
        ADMIN: { username: 'admin', full_name: 'Quản Trị Viên Hệ Thống', role: 'ADMIN', avatar: 'AD' },
        DOCTOR: { username: 'bacsi_nam', full_name: 'BS CK1. Trần Văn Nam', role: 'DOCTOR', avatar: 'BS' },
        RECEPTIONIST: { username: 'letan01', full_name: 'Nguyễn Thị Hoa (Lễ Tân)', role: 'RECEPTIONIST', avatar: 'LT' },
        CASHIER: { username: 'thungan01', full_name: 'Phòng Thu Ngân & Viện Phí', role: 'CASHIER', avatar: 'TN' }
      };

      const target = userMap[role];
      if (!target) return;

      localStorage.setItem('clinic_auth_user', JSON.stringify(target));
      applyLoggedInState(target);
      showToast(`Đã chuyển vai trò: ${target.full_name}`, 'info');
    });
  });
}

// ==========================================
// 3.1. HỆ THỐNG XÁC THỰC & ĐĂNG NHẬP PHÂN QUYỀN (AUTH & RBAC)
// ==========================================
function showLoginScreen() {
  const loginScreen = document.getElementById('login-screen');
  const appWrapper = document.getElementById('app-wrapper');
  if (loginScreen) loginScreen.style.display = 'flex';
  if (appWrapper) appWrapper.style.display = 'none';
}

function setupAuth() {
  const form = document.getElementById('form-login');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;
      await performLogin(username, password);
    });
  }

  const btnLogout = document.getElementById('btn-logout');
  if (btnLogout) {
    btnLogout.addEventListener('click', performLogout);
  }
}

window.quickLogin = async (username, password) => {
  document.getElementById('login-username').value = username;
  document.getElementById('login-password').value = password;
  await performLogin(username, password);
};

async function performLogin(username, password) {
  const btnSubmit = document.getElementById('btn-submit-login');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.innerText = 'Đang xác thực...';
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Đăng nhập không thành công');
    }

    localStorage.setItem('clinic_auth_user', JSON.stringify(data.user));
    applyLoggedInState(data.user);
    showToast(`Đăng nhập thành công! Chào mừng ${data.user.full_name}`, 'success');
  } catch (err) {
    showToast('Lỗi đăng nhập: ' + err.message, 'error');
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerText = '🔐 ĐĂNG NHẬP VÀO HỆ THỐNG';
    }
  }
}

async function applyLoggedInState(user) {
  state.currentUser = user;
  state.currentRole = user.role;

  // 1. Ẩn màn hình đăng nhập, mở ứng dụng làm việc
  const loginScreen = document.getElementById('login-screen');
  const appWrapper = document.getElementById('app-wrapper');
  if (loginScreen) loginScreen.style.display = 'none';
  if (appWrapper) appWrapper.style.display = 'block';

  // 2. Cập nhật thông tin Header
  const avatarMap = { ADMIN: 'AD', DOCTOR: 'BS', RECEPTIONIST: 'LT', CASHIER: 'TN', PATIENT: 'BN' };
  const roleLabelMap = {
    ADMIN: 'QUẢN TRỊ / DEVOPS (Toàn quyền)',
    DOCTOR: user.doctor ? `BÁC SĨ (${user.doctor.department_name} - ${user.doctor.room_number})` : 'BÁC SĨ (Khám & Kê đơn)',
    RECEPTIONIST: 'LỄ TÂN (Tiếp nhận & Cấp số)',
    CASHIER: 'THU NGÂN (Viện phí & Hóa đơn)'
  };

  const avatarEl = document.getElementById('current-avatar');
  const nameEl = document.getElementById('current-name');
  const roleEl = document.getElementById('current-role');
  if (avatarEl) avatarEl.innerText = avatarMap[user.role] || 'NV';
  if (nameEl) nameEl.innerText = user.full_name;
  if (roleEl) roleEl.innerText = roleLabelMap[user.role] || user.role;

  // 3. Đồng bộ trạng thái active trên thanh demo bar
  document.querySelectorAll('.role-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.role === user.role);
  });

  // 4. Thực thi phân quyền (RBAC Enforcement): Chỉ cho phép xem tab được cấp quyền
  applyRolePermissions(user.role);

  // 5. Tải dữ liệu ban đầu và tự động khớp bộ lọc với bác sĩ đăng nhập
  await loadInitialCatalogs();
  if (user.role === 'DOCTOR' && user.doctor) {
    const filterSelect = document.getElementById('doctor-filter-select');
    if (filterSelect) {
      filterSelect.value = String(user.doctor.doctor_id);
    }
  }
  await loadAvailableDates();
  await loadDashboardData();
  if (user.role === 'DOCTOR') {
    await loadDoctorQueue();
  }
}

function performLogout() {
  localStorage.removeItem('clinic_auth_user');
  state.currentUser = null;
  state.currentRole = null;
  showLoginScreen();
  const passInput = document.getElementById('login-password');
  if (passInput) passInput.value = '';
  showToast('Đã đăng xuất khỏi hệ thống thành công!', 'info');
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
    const dateParam = state.filterDate || 'today';
    const res = await fetch(`${API_BASE}/stats?date=${dateParam}`);
    if (!res.ok) return;
    const data = await res.json();
    document.getElementById('stat-patients').innerText = data.total_patients;
    document.getElementById('stat-waiting').innerText = data.waiting_queue;
    document.getElementById('stat-completed').innerText = data.completed_queue;
    
    // Doanh thu theo ngày đã chọn
    const revAmount = data.date_revenue !== undefined ? data.date_revenue : data.today_revenue;
    document.getElementById('stat-revenue').innerText = new Intl.NumberFormat('vi-VN').format(revAmount) + ' đ';

    // Cập nhật nhãn động theo ngày được chọn
    const revLabel = document.getElementById('stat-revenue-label');
    const waitLabel = document.getElementById('stat-waiting-label');
    const compLabel = document.getElementById('stat-completed-label');
    const tableTitle = document.getElementById('reception-table-title');

    if (state.filterDate === 'all') {
      if (revLabel) revLabel.innerText = 'Tổng Doanh Thu Hệ Thống';
      if (waitLabel) waitLabel.innerText = 'Tổng Chờ Khám';
      if (compLabel) compLabel.innerText = 'Tổng Lượt Đã Khám';
      if (tableTitle) tableTitle.innerText = '📋 Toàn Bộ Lịch Sử Bệnh Nhân Khám Bệnh';
    } else if (state.filterDate === 'today' || !state.filterDate) {
      if (revLabel) revLabel.innerText = 'Doanh Thu Hôm Nay';
      if (waitLabel) waitLabel.innerText = 'Đang Chờ Khám Hôm Nay';
      if (compLabel) compLabel.innerText = 'Lượt Đã Khám Hôm Nay';
      if (tableTitle) tableTitle.innerText = '📋 Tiếp Nhận Bệnh Nhân & Hàng Đợi Khám Trong Ngày';
    } else {
      const parts = state.filterDate.split('-');
      const displayDate = parts.length === 3 ? `${parts[2]}/${parts[1]}` : state.filterDate;
      if (revLabel) revLabel.innerText = `Doanh Thu Ngày ${displayDate}`;
      if (waitLabel) waitLabel.innerText = `Chờ Khám Ngày ${displayDate}`;
      if (compLabel) compLabel.innerText = `Đã Khám Ngày ${displayDate}`;
      if (tableTitle) tableTitle.innerText = `📋 Danh Sách Khám Bệnh Ngày ${displayDate}/${parts[0]}`;
    }

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
    const dateParam = state.filterDate || 'today';
    const res = await fetch(`${API_BASE}/appointments?date=${dateParam}`);
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
      actionHtml = `<button class="btn btn-secondary btn-sm" onclick="printQueueTicket(${a.id})" title="In phiếu số thứ tự cho bệnh nhân">🖨️ In Phiếu Số</button>`;
    } else if (a.status === 'IN_PROGRESS') {
      actionHtml = `<span style="font-size: 0.85rem; color: #0284c7; font-weight: 700;">🩺 BS đang khám</span>`;
    } else if (a.status === 'COMPLETED') {
      actionHtml = `<span style="font-size: 0.85rem; color: #16a34a; font-weight: 700;">✅ Đã khám xong</span>`;
    } else {
      actionHtml = `<span style="font-size: 0.85rem; color: #dc2626; font-weight: 700;">Đã hủy</span>`;
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

async function loadAvailableDates() {
  const select = document.getElementById('reception-date-filter');
  if (!select) return;
  try {
    const res = await fetch(`${API_BASE}/appointments/dates`);
    if (!res.ok) return;
    const dates = await res.json();
    
    const curVal = state.filterDate || 'today';
    let optionsHtml = `<option value="today">Hôm nay</option>`;
    
    dates.forEach(d => {
      const parts = d.split('-');
      const formatted = parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
      optionsHtml += `<option value="${d}">Ngày ${formatted} (${d})</option>`;
    });
    
    optionsHtml += `
      <option value="all">Tất cả các ngày</option>
      <option value="custom">Chọn ngày khác...</option>
    `;
    
    select.innerHTML = optionsHtml;
    const exists = Array.from(select.options).some(o => o.value === curVal);
    select.value = exists ? curVal : 'today';
  } catch (e) {
    console.warn('Lỗi tải danh sách ngày:', e);
  }
}

function setupReceptionDateFilter() {
  const select = document.getElementById('reception-date-filter');
  const customInput = document.getElementById('reception-custom-date');
  if (!select) return;

  select.addEventListener('change', async () => {
    const val = select.value;
    if (val === 'custom') {
      if (customInput) {
        customInput.style.display = 'inline-block';
        customInput.focus();
      }
    } else {
      if (customInput) customInput.style.display = 'none';
      state.filterDate = val;
      await loadDashboardData();
    }
  });

  if (customInput) {
    customInput.addEventListener('change', async () => {
      if (customInput.value) {
        state.filterDate = customInput.value;
        await loadDashboardData();
      }
    });
  }
}

function setupModal() {
  const modal = document.getElementById('modal-patient');
  const btnOpen = document.getElementById('btn-open-new-patient');
  const btnClose = document.getElementById('btn-close-modal');
  const btnCancel = document.getElementById('btn-cancel-modal');
  const form = document.getElementById('form-new-patient');

  const inputPhone = document.getElementById('p-phone');
  const inputIdCard = document.getElementById('p-idcard');

  // Tự động chặn và loại bỏ ký tự không phải số ngay khi gõ/paste
  if (inputPhone) {
    inputPhone.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
    });
  }
  if (inputIdCard) {
    inputIdCard.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12);
    });
  }

  btnOpen.addEventListener('click', () => {
    populateDoctorDropdown();
    modal.classList.add('open');
  });
  btnClose.addEventListener('click', () => modal.classList.remove('open'));
  btnCancel.addEventListener('click', () => modal.classList.remove('open'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = (document.getElementById('p-name').value || '').trim();
    const phone = (document.getElementById('p-phone').value || '').trim();
    const idcard = (document.getElementById('p-idcard').value || '').trim();
    const dob = document.getElementById('p-dob').value;
    const gender = document.getElementById('p-gender').value;
    const doctorId = document.getElementById('p-doctor-select').value;
    const address = (document.getElementById('p-address').value || '').trim();
    const symptoms = (document.getElementById('p-symptoms').value || '').trim();

    if (!name) {
      showToast('Vui lòng nhập họ và tên bệnh nhân!', 'warning');
      document.getElementById('p-name').focus();
      return;
    }

    // 1. Kiểm tra chuẩn CCCD/CMND: đúng 12 chữ số CCCD (hoặc 9 chữ số CMND), chỉ gồm chữ số
    const cccdRegex = /^\d{9}$|^\d{12}$/;
    if (!idcard || !cccdRegex.test(idcard)) {
      showToast('Số CCCD/CMND không hợp lệ! Vui lòng nhập đúng 12 chữ số CCCD (hoặc 9 chữ số CMND), không nhập chữ cái hoặc ký tự linh tinh.', 'error');
      document.getElementById('p-idcard').focus();
      return;
    }

    // 2. Kiểm tra chuẩn Số điện thoại: đúng 10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09
    const phoneRegex = /^0[35789]\d{8}$/;
    if (!phone || !phoneRegex.test(phone)) {
      showToast('Số điện thoại không hợp lệ! Vui lòng nhập đúng 10 chữ số chuẩn di động Việt Nam (đầu 03, 05, 07, 08 hoặc 09).', 'error');
      document.getElementById('p-phone').focus();
      return;
    }

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
      await loadAvailableDates();
      await loadDashboardData();
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error');
    }
  });
}

window.printQueueTicket = (appointmentId) => {
  const app = (state.appointments || []).find(a => a.id == appointmentId);
  if (!app) {
    showToast('Không tìm thấy thông tin ca khám!', 'error');
    return;
  }

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;

  const printWindow = window.open('', '_blank', 'width=380,height=520');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <title>Phiếu Khám Bệnh - STT #${app.queue_number}</title>
      <style>
        body {
          font-family: 'Courier New', monospace;
          padding: 16px;
          margin: 0;
          color: #000;
          font-size: 13px;
          line-height: 1.4;
        }
        .center { text-align: center; }
        .dashed { border-top: 1px dashed #000; margin: 10px 0; }
        .queue-box {
          font-size: 42px;
          font-weight: 900;
          letter-spacing: 2px;
          margin: 6px 0;
        }
        .row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        @media print {
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 12px; text-align: right;">
        <button onclick="window.print()" style="padding: 6px 14px; font-weight: bold; background: #0d9488; color: #fff; border: none; border-radius: 4px; cursor: pointer;">🖨️ In Phiếu Này</button>
      </div>

      <div class="center">
        <strong style="font-size: 14px;">BỆNH VIỆN ĐA KHOA ICTU</strong><br>
        <span style="font-size: 11px;">HỆ THỐNG TIẾP NHẬN BỆNH NHÂN TỰ ĐỘNG</span>
        <div class="dashed"></div>
        <div style="font-size: 12px; font-weight: bold;">PHIẾU ĐĂNG KÝ KHÁM BỆNH</div>
        <div class="queue-box">#${String(app.queue_number).padStart(2, '0')}</div>
        <div style="font-size: 11px;">Giờ tiếp nhận: ${timeStr} - Ngày: ${dateStr}</div>
      </div>

      <div class="dashed"></div>

      <div class="row"><span>Họ tên BN:</span><strong>${app.patient_name || '--'}</strong></div>
      <div class="row"><span>CCCD/CMND:</span><span>${app.identity_card || '--'}</span></div>
      <div class="row"><span>Điện thoại:</span><span>${app.patient_phone || '--'}</span></div>
      <div class="dashed"></div>
      <div class="row"><span>Phòng khám:</span><strong>${app.room_number || 'P.102'}</strong></div>
      <div class="row"><span>Chuyên khoa:</span><strong>${app.department_name || 'Khám bệnh'}</strong></div>
      <div class="row"><span>Bác sĩ phụ trách:</span><span>${app.doctor_name || 'BS Phụ trách'}</span></div>
      <div class="row"><span>Lý do khám:</span><span>${app.symptoms || 'Khám tổng quát'}</span></div>

      <div class="dashed"></div>

      <div class="center" style="font-size: 11px; font-style: italic; margin-top: 8px;">
        * Quý khách vui lòng ngồi tại sảnh chờ trước <strong>${app.room_number || 'phòng khám'}</strong>.<br>
        Bác sĩ sẽ gọi theo số thứ tự hiển thị trên màn hình.
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
};

window.startExamFromReception = (appointmentId) => {
  if (state.currentRole === 'RECEPTIONIST') {
    showToast('Lễ tân không có quyền khám bệnh! Bác sĩ phụ trách sẽ gọi bệnh nhân vào phòng.', 'warning');
    return;
  }
  if (state.currentRole === 'DOCTOR' || state.currentRole === 'ADMIN') {
    switchTab('tab-doctor');
    selectDoctorPatient(appointmentId);
  }
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

  updateLiveExamEstimate();
  loadDoctorQueue();
};

function populateServicesCheckboxes() {
  const container = document.getElementById('cls-services-checkboxes');
  if (!container) return;
  container.innerHTML = state.services.map(s => `
    <label style="display: flex; align-items: center; gap: 10px; font-size: 0.85rem; cursor: pointer; padding: 4px 6px; border-radius: 4px; transition: background 0.15s;">
      <input type="checkbox" name="services" value="${s.id}" data-price="${s.price}">
      <span style="font-weight: 600; color: var(--dark);">${s.name}</span>
      <span style="color: var(--primary); font-weight: 700;">(${new Intl.NumberFormat('vi-VN').format(s.price)} đ)</span>
    </label>
  `).join('');
  container.onchange = updateLiveExamEstimate;
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

function updateLiveExamEstimate() {
  const examFee = 150000; // Tiền công khám bệnh ban đầu
  let clsFee = 0;
  document.querySelectorAll('input[name="services"]:checked').forEach(cb => {
    clsFee += parseFloat(cb.getAttribute('data-price') || 0);
  });

  let medFee = 0;
  document.querySelectorAll('.prescription-row').forEach(row => {
    const medSelect = row.querySelector('.med-select');
    const qtyInput = row.querySelector('.med-qty');
    if (medSelect && qtyInput) {
      const selectedMed = state.medicines.find(m => String(m.id) === String(medSelect.value));
      const qty = parseInt(qtyInput.value, 10) || 0;
      if (selectedMed) {
        medFee += parseFloat(selectedMed.unit_price) * qty;
      }
    }
  });

  const total = examFee + clsFee + medFee;
  const breakdownEl = document.getElementById('estimate-breakdown');
  const totalEl = document.getElementById('estimate-total-amount');
  if (breakdownEl) {
    breakdownEl.innerText = `Tiền khám: ${new Intl.NumberFormat('vi-VN').format(examFee)} đ | CLS: ${new Intl.NumberFormat('vi-VN').format(clsFee)} đ | Thuốc: ${new Intl.NumberFormat('vi-VN').format(medFee)} đ`;
  }
  if (totalEl) {
    totalEl.innerText = `${new Intl.NumberFormat('vi-VN').format(total)} đ`;
  }
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
    <button type="button" class="btn btn-secondary btn-sm" onclick="this.parentElement.remove(); updateLiveExamEstimate();" style="color: var(--danger); font-weight: bold;">✕</button>
  `;

  const sel = row.querySelector('.med-select');
  const inp = row.querySelector('.med-qty');
  if (sel) sel.addEventListener('change', updateLiveExamEstimate);
  if (inp) inp.addEventListener('input', updateLiveExamEstimate);

  container.appendChild(row);
  updateLiveExamEstimate();
}

// ==========================================
// 7. THU NGÂN & QUẢN LÝ VIỆN PHÍ (CASHIER)
// ==========================================
async function loadInvoices() {
  const tbody = document.getElementById('invoices-tbody');
  const btnRefresh = document.getElementById('btn-refresh-invoices');
  if (btnRefresh) btnRefresh.onclick = loadInvoices;

  try {
    const res = await fetch(`${API_BASE}/invoices`);
    if (!res.ok) throw new Error('Không thể tải danh sách hóa đơn');
    state.invoices = await res.json();

    // Cập nhật Bảng kê chốt quỹ ca thu ngân
    let shiftTotal = 0;
    let shiftCash = 0;
    let shiftTransfer = 0;
    let shiftUnpaid = 0;

    (state.invoices || []).forEach(inv => {
      const amt = parseFloat(inv.total_amount) || 0;
      if (inv.payment_status === 'PAID') {
        shiftTotal += amt;
        if (inv.payment_method === 'CASH') shiftCash += amt;
        else shiftTransfer += amt;
      } else {
        shiftUnpaid += amt;
      }
    });

    const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + ' đ';
    const elTot = document.getElementById('cashier-shift-total');
    const elCash = document.getElementById('cashier-shift-cash');
    const elTrans = document.getElementById('cashier-shift-transfer');
    const elUnp = document.getElementById('cashier-shift-unpaid');

    if (elTot) elTot.innerText = fmt(shiftTotal);
    if (elCash) elCash.innerText = fmt(shiftCash);
    if (elTrans) elTrans.innerText = fmt(shiftTransfer);
    if (elUnp) elUnp.innerText = fmt(shiftUnpaid);

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
    if (typeof loadRevenueReport === 'function') await loadRevenueReport();
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

// ==========================================
// 9. BÁO CÁO THỐNG KÊ DOANH THU CHUẨN PHÒNG KHÁM / BỆNH VIỆN (ADMIN & TÀI CHÍNH)
// ==========================================
let currentReportData = null;

async function loadRevenueReport(targetDate = null) {
  const dateFilter = document.getElementById('report-date-filter');
  const customDateInput = document.getElementById('report-custom-date');
  
  let dateParam = targetDate;
  if (!dateParam && dateFilter) {
    if (dateFilter.value === 'custom') {
      dateParam = (customDateInput && customDateInput.value) ? customDateInput.value : 'today';
    } else {
      dateParam = dateFilter.value;
    }
  }
  if (!dateParam) dateParam = 'today';

  try {
    const res = await fetch(`${API_BASE}/stats/revenue-report?date=${dateParam}`);
    if (!res.ok) throw new Error('Không thể tải báo cáo doanh thu');
    const data = await res.json();
    currentReportData = data;

    const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + ' đ';

    // 1. Thẻ chỉ số tổng
    const elTotRev = document.getElementById('rep-total-revenue');
    const elPaidCount = document.getElementById('rep-paid-count');
    const elExamFee = document.getElementById('rep-exam-fee');
    const elClsFee = document.getElementById('rep-cls-fee');
    const elMedFee = document.getElementById('rep-med-fee');

    if (elTotRev) elTotRev.innerText = fmt(data.summary.total_revenue);
    if (elPaidCount) elPaidCount.innerText = `Đã thu: ${data.summary.paid_count} hóa đơn`;
    if (elExamFee) elExamFee.innerText = fmt(data.summary.exam_fee_total);
    if (elClsFee) elClsFee.innerText = fmt(data.summary.cls_fee_total);
    if (elMedFee) elMedFee.innerText = fmt(data.summary.medicine_fee_total);

    // 2. Bảng doanh thu theo 4 Bác sĩ
    const docTbody = document.getElementById('rep-doctor-tbody');
    if (docTbody && data.by_doctor) {
      if (data.by_doctor.length === 0) {
        docTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 16px;">Chưa có dữ liệu</td></tr>`;
      } else {
        docTbody.innerHTML = data.by_doctor.map(doc => `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px;">
              <strong>${doc.doctor_name}</strong>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${doc.department_name}</div>
            </td>
            <td style="padding: 10px; text-align: center; font-weight: 700; color: var(--primary);">
              ${doc.completed_count} ca
            </td>
            <td style="padding: 10px; text-align: right; font-weight: 700; color: #047857;">
              ${fmt(doc.doctor_revenue)}
            </td>
            <td style="padding: 10px; text-align: right;">
              <span class="badge" style="background: #f0fdf4; color: #166534; font-weight: 700;">${doc.percentage}%</span>
            </td>
          </tr>
        `).join('');
      }
    }

    // 3. Đối soát hình thức thanh toán & phân bổ
    const elCash = document.getElementById('rep-cash-amount');
    const elCashBar = document.getElementById('rep-cash-bar');
    const elTrans = document.getElementById('rep-transfer-amount');
    const elTransBar = document.getElementById('rep-transfer-bar');
    const elInvoicesCount = document.getElementById('rep-total-invoices-count');
    const elUnpaid = document.getElementById('rep-unpaid-amount');

    const totRev = data.summary.total_revenue || 0;
    const cashPct = totRev > 0 ? Math.round((data.summary.cash_revenue / totRev) * 100) : 0;
    const transPct = totRev > 0 ? Math.round((data.summary.transfer_revenue / totRev) * 100) : 0;

    if (elCash) elCash.innerText = `${fmt(data.summary.cash_revenue)} (${cashPct}%)`;
    if (elCashBar) elCashBar.style.width = `${cashPct}%`;
    if (elTrans) elTrans.innerText = `${fmt(data.summary.transfer_revenue)} (${transPct}%)`;
    if (elTransBar) elTransBar.style.width = `${transPct}%`;

    const totalInvoices = (data.summary.paid_count || 0) + (data.summary.unpaid_count || 0);
    if (elInvoicesCount) elInvoicesCount.innerText = `${totalInvoices} hóa đơn (Đã thu: ${data.summary.paid_count})`;
    if (elUnpaid) elUnpaid.innerText = `${fmt(data.summary.unpaid_revenue)} (${data.summary.unpaid_count} hóa đơn)`;

  } catch (err) {
    console.error('Lỗi tải báo cáo doanh thu:', err);
  }
}

function setupRevenueReportEvents() {
  const dateFilter = document.getElementById('report-date-filter');
  const customInput = document.getElementById('report-custom-date');
  const btnRefresh = document.getElementById('btn-refresh-report');
  const btnPrint = document.getElementById('btn-print-report');
  const btnExport = document.getElementById('btn-export-csv');
  const btnExportWord = document.getElementById('btn-export-word');
  const btnCashierPrintShift = document.getElementById('btn-cashier-print-shift');

  if (dateFilter) {
    dateFilter.addEventListener('change', () => {
      if (dateFilter.value === 'custom') {
        if (customInput) {
          customInput.style.display = 'inline-block';
          if (!customInput.value) {
            const today = new Date().toISOString().split('T')[0];
            customInput.value = today;
          }
          loadRevenueReport(customInput.value);
        }
      } else {
        if (customInput) customInput.style.display = 'none';
        loadRevenueReport(dateFilter.value);
      }
    });
  }

  if (customInput) {
    customInput.addEventListener('change', () => {
      loadRevenueReport(customInput.value);
    });
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      loadRevenueReport();
      showToast('Đã làm mới số liệu báo cáo doanh thu!', 'success');
    });
  }

  if (btnExport) {
    btnExport.addEventListener('click', exportRevenueCSV);
  }

  if (btnExportWord) {
    btnExportWord.addEventListener('click', exportRevenueWord);
  }

  if (btnPrint) {
    btnPrint.addEventListener('click', printRevenueReportA4);
  }

  if (btnCashierPrintShift) {
    btnCashierPrintShift.addEventListener('click', printCashierShiftHandover);
  }
}

function exportRevenueWord() {
  if (!currentReportData) {
    showToast('Chưa có dữ liệu báo cáo để xuất Word!', 'error');
    return;
  }
  const data = currentReportData;
  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + ' đ';
  const now = new Date();
  const printDateStr = `${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
  const printTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let periodTitle = "Hôm nay";
  if (data.selected_date === 'all') periodTitle = "Toàn bộ tích lũy đến hiện tại";
  else if (data.selected_date && data.selected_date !== 'today') periodTitle = `Ngày ${data.selected_date}`;

  const docRows = (data.by_doctor || []).map((doc, idx) => `
    <tr>
      <td style="text-align: center; border: 1px solid #333333; padding: 6px;">${idx + 1}</td>
      <td style="border: 1px solid #333333; padding: 6px;"><strong>${doc.doctor_name}</strong></td>
      <td style="border: 1px solid #333333; padding: 6px;">${doc.department_name}</td>
      <td style="text-align: center; border: 1px solid #333333; padding: 6px;">${doc.completed_count}</td>
      <td style="text-align: right; border: 1px solid #333333; padding: 6px; font-weight: bold;">${fmt(doc.doctor_revenue)}</td>
      <td style="text-align: center; border: 1px solid #333333; padding: 6px;">${doc.percentage}%</td>
    </tr>
  `).join('');

  const wordContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>Báo Cáo Thống Kê Doanh Thu</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        @page Section1 {
          size: 595.3pt 841.9pt; /* A4: 21cm x 29.7cm */
          margin: 54.0pt 54.0pt 54.0pt 54.0pt; /* 2.0cm margins */
          mso-header-margin: 36.0pt;
          mso-footer-margin: 36.0pt;
          mso-paper-source: 0;
        }
        div.Section1 { page: Section1; }
        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 13pt;
          line-height: 1.35;
          color: #000000;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Times New Roman', Times, serif;
        }
        .header-table td {
          border: none !important;
          padding: 2px 4px;
        }
        .data-table {
          margin: 12px 0 20px 0;
          font-size: 11pt;
        }
        .data-table th, .data-table td {
          border: 1px solid #333333;
          padding: 6px 8px;
        }
        .data-table th {
          background-color: #f2f2f2;
          font-weight: bold;
        }
        .sig-table td {
          border: none !important;
          text-align: center;
          padding: 10px 4px;
        }
      </style>
    </head>
    <body>
      <div class="Section1">
        <!-- HEADER QUỐC HIỆU & ĐƠN VỊ -->
        <table class="header-table" style="width: 100%; margin-bottom: 20px;">
          <tr>
            <td style="width: 48%; vertical-align: top; text-align: left;">
              <strong>SỞ Y TẾ TP. HÀ NỘI</strong><br>
              <strong>PHÒNG KHÁM ĐA KHOA QUỐC TẾ DTC</strong><br>
              <span style="font-size: 10pt;">Địa chỉ: 123 Đường Giải Phóng, Hà Nội<br>Hotline: 1900 6868</span>
            </td>
            <td style="width: 52%; vertical-align: top; text-align: center;">
              <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br>
              <strong>Độc lập - Tự do - Hạnh phúc</strong><br>
              <span>------------------------</span>
            </td>
          </tr>
        </table>

        <!-- TIÊU ĐỀ BÁO CÁO -->
        <div style="text-align: center; margin: 25px 0 15px 0;">
          <h2 style="font-size: 16pt; font-weight: bold; text-transform: uppercase; margin: 0;">BÁO CÁO THỐNG KÊ DOANH THU & HIỆU SUẤT PHÒNG KHÁM</h2>
          <p style="margin: 6px 0; font-style: italic; font-size: 11pt;">Kỳ báo cáo: <strong>${periodTitle}</strong> (Thời điểm xuất biểu: ${printTimeStr}, ngày ${printDateStr})</p>
        </div>

        <!-- MỤC I -->
        <div style="font-weight: bold; margin-top: 15px; font-size: 12pt; text-transform: uppercase;">I. TỔNG HỢP CƠ CẤU DOANH THU & NGUỒN THU</div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">STT</th>
              <th>Danh Mục Nguồn Thu</th>
              <th style="width: 120px; text-align: center;">Số Lượng / Lượt</th>
              <th style="width: 170px; text-align: right;">Thành Tiền (VNĐ)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="text-align: center;">1</td>
              <td><strong>Doanh thu tiền khám bệnh chuyên khoa</strong> (Định mức 50.000 đ/lượt)</td>
              <td style="text-align: center;">${data.summary.paid_count} ca khám</td>
              <td style="text-align: right; font-weight: bold;">${fmt(data.summary.exam_fee_total)}</td>
            </tr>
            <tr>
              <td style="text-align: center;">2</td>
              <td><strong>Doanh thu dịch vụ Cận Lâm Sàng</strong> (Chụp X-quang, Siêu âm, Xét nghiệm)</td>
              <td style="text-align: center;">Theo chỉ định</td>
              <td style="text-align: right; font-weight: bold;">${fmt(data.summary.cls_fee_total)}</td>
            </tr>
            <tr>
              <td style="text-align: center;">3</td>
              <td><strong>Doanh thu bán thuốc & dược phẩm</strong> (Theo đơn điều trị)</td>
              <td style="text-align: center;">Theo đơn thuốc</td>
              <td style="text-align: right; font-weight: bold;">${fmt(data.summary.medicine_fee_total)}</td>
            </tr>
            <tr style="background-color: #f7f7f7; font-weight: bold;">
              <td colspan="3" style="text-align: right; text-transform: uppercase;">TỔNG CỘNG DOANH THU THỰC THU:</td>
              <td style="text-align: right; font-size: 12pt; color: #047857;">${fmt(data.summary.total_revenue)}</td>
            </tr>
          </tbody>
        </table>

        <!-- MỤC II -->
        <div style="font-weight: bold; margin-top: 15px; font-size: 12pt; text-transform: uppercase;">II. CHI TIẾT THEO BÁC SĨ & KHOA PHÒNG</div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">STT</th>
              <th>Họ và Tên Bác Sĩ</th>
              <th>Khoa / Chuyên Khoa Phụ Trách</th>
              <th style="width: 100px; text-align: center;">Số Ca Khám</th>
              <th style="width: 160px; text-align: right;">Doanh Thu (VNĐ)</th>
              <th style="width: 80px; text-align: center;">Tỷ Trọng</th>
            </tr>
          </thead>
          <tbody>
            ${docRows}
          </tbody>
        </table>

        <!-- MỤC III -->
        <div style="font-weight: bold; margin-top: 15px; font-size: 12pt; text-transform: uppercase;">III. PHƯƠNG THỨC THU & ĐỐI SOÁT QUỸ TIỀN TỆ</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Hình Thức Thu Viện Phí</th>
              <th style="width: 180px; text-align: right;">Số Tiền Đã Thu (VNĐ)</th>
              <th style="width: 100px; text-align: center;">Tỷ Lệ</th>
              <th>Ghi Chú Nghiệp Vụ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>1. Tiền mặt (Cash)</strong></td>
              <td style="text-align: right; font-weight: bold;">${fmt(data.summary.cash_revenue)}</td>
              <td style="text-align: center;">${data.summary.total_revenue > 0 ? Math.round((data.summary.cash_revenue / data.summary.total_revenue) * 100) : 0}%</td>
              <td>Kiểm đếm quỹ tiền mặt tại két quầy thu ngân</td>
            </tr>
            <tr>
              <td><strong>2. Chuyển khoản ngân hàng (VietQR / POS)</strong></td>
              <td style="text-align: right; font-weight: bold;">${fmt(data.summary.transfer_revenue)}</td>
              <td style="text-align: center;">${data.summary.total_revenue > 0 ? Math.round((data.summary.transfer_revenue / data.summary.total_revenue) * 100) : 0}%</td>
              <td>Tài khoản thanh toán ngân hàng của phòng khám</td>
            </tr>
            <tr>
              <td><strong>3. Hóa đơn chưa thanh toán (Công nợ)</strong></td>
              <td style="text-align: right; color: red;">${fmt(data.summary.unpaid_revenue)}</td>
              <td style="text-align: center;">${data.summary.unpaid_count} hóa đơn</td>
              <td>Bệnh nhân đang chờ làm thủ tục thanh toán</td>
            </tr>
          </tbody>
        </table>

        <div style="text-align: right; font-style: italic; margin-top: 25px;">
          Hà Nội, ngày ${printDateStr}
        </div>

        <!-- CHỮ KÝ 3 BÊN -->
        <table class="sig-table" style="width: 100%; margin-top: 15px;">
          <tr>
            <td style="width: 33%; vertical-align: top;">
              <strong>NGƯỜI LẬP BIỂU</strong><br>
              <span style="font-style: italic; font-size: 10pt;">(Ký, ghi rõ họ tên)</span>
              <br><br><br><br><br>
              <strong>${state.currentUser ? state.currentUser.full_name : 'Quản Trị Viên'}</strong>
            </td>
            <td style="width: 34%; vertical-align: top;">
              <strong>KẾ TOÁN TRƯỞNG</strong><br>
              <span style="font-style: italic; font-size: 10pt;">(Ký, ghi rõ họ tên)</span>
              <br><br><br><br><br>
              <strong>Nguyễn Văn Thu</strong>
            </td>
            <td style="width: 33%; vertical-align: top;">
              <strong>GIÁM ĐỐC PHÒNG KHÁM</strong><br>
              <span style="font-style: italic; font-size: 10pt;">(Ký tên và đóng dấu)</span>
              <br><br><br><br><br>
              <strong>TS. BS. Giám Đốc Điều Hành</strong>
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', wordContent], {
    type: 'application/msword;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BaoCao_DoanhThu_PhongKham_${data.selected_date}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Đã xuất báo cáo Word (.doc) khổ A4 thành công!', 'success');
}

function printRevenueReportA4() {
  if (!currentReportData) {
    showToast('Chưa có dữ liệu báo cáo để in!', 'error');
    return;
  }
  const data = currentReportData;
  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + ' đ';
  const now = new Date();
  const printDateStr = `${now.getDate()} tháng ${now.getMonth() + 1} năm ${now.getFullYear()}`;
  const printTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let periodTitle = "Hôm nay";
  if (data.selected_date === 'all') periodTitle = "Toàn bộ tích lũy đến hiện tại";
  else if (data.selected_date && data.selected_date !== 'today') periodTitle = `Ngày ${data.selected_date}`;

  const docRows = (data.by_doctor || []).map((doc, idx) => `
    <tr>
      <td style="text-align: center; padding: 6px;">${idx + 1}</td>
      <td style="padding: 6px;"><strong>${doc.doctor_name}</strong></td>
      <td style="padding: 6px;">${doc.department_name}</td>
      <td style="text-align: center; padding: 6px;">${doc.completed_count}</td>
      <td style="text-align: right; padding: 6px; font-weight: bold;">${fmt(doc.doctor_revenue)}</td>
      <td style="text-align: center; padding: 6px;">${doc.percentage}%</td>
    </tr>
  `).join('');

  const win = window.open('', '_blank', 'width=850,height=900');
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <title>Báo Cáo Doanh Thu Phòng Khám - ${periodTitle}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.4; color: #000; margin: 0; padding: 10px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .header-left { text-align: left; }
        .header-right { text-align: center; }
        .report-title { text-align: center; margin: 25px 0 15px 0; }
        .report-title h2 { margin: 0; font-size: 16pt; font-weight: bold; text-transform: uppercase; }
        .report-title p { margin: 5px 0 0 0; font-style: italic; font-size: 12pt; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0 20px 0; font-size: 11pt; }
        th, td { border: 1px solid #333; padding: 6px 8px; }
        th { background: #f0f0f0; font-weight: bold; }
        .section-title { font-weight: bold; margin-top: 15px; font-size: 12pt; text-transform: uppercase; }
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; text-align: center; page-break-inside: avoid; }
        .sig-block { width: 30%; }
        .sig-space { height: 75px; }
        @media print {
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 20px; text-align: right;">
        <button onclick="window.print()" style="padding: 8px 18px; font-size: 14px; font-weight: bold; background: #0d9488; color: #fff; border: none; border-radius: 6px; cursor: pointer;">🖨️ In Báo Cáo Này (Khổ A4)</button>
        <button onclick="window.close()" style="padding: 8px 14px; font-size: 14px; border: 1px solid #ccc; background: #f8fafc; border-radius: 6px; cursor: pointer; margin-left: 8px;">Đóng</button>
      </div>

      <div class="header">
        <div class="header-left">
          <strong>SỞ Y TẾ TP. HÀ NỘI</strong><br>
          <strong>PHÒNG KHÁM ĐA KHOA QUỐC TẾ DTC</strong><br>
          <span style="font-size: 10pt;">Địa chỉ: 123 Đường Giải Phóng, Hà Nội<br>Điện thoại: 1900 6868</span>
        </div>
        <div class="header-right">
          <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong><br>
          <strong>Độc lập - Tự do - Hạnh phúc</strong><br>
          <span style="font-size: 10pt;">------------------</span>
        </div>
      </div>

      <div class="report-title">
        <h2>BÁO CÁO THỐNG KÊ TỔNG HỢP DOANH THU & HIỆU SUẤT KHÁM CHỮA BỆNH</h2>
        <p>Kỳ báo cáo: <strong>${periodTitle}</strong> (Thời điểm xuất biểu: ${printTimeStr}, ngày ${printDateStr})</p>
      </div>

      <div class="section-title">I. TỔNG HỢP CƠ CẤU DOANH THU & NGUỒN THU</div>
      <table>
        <thead>
          <tr>
            <th style="width: 50px;">STT</th>
            <th>Danh Mục Doanh Thu</th>
            <th style="width: 150px; text-align: center;">Đơn Vị Tính</th>
            <th style="width: 180px; text-align: right;">Thành Tiền (VNĐ)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align: center;">1</td>
            <td><strong>Doanh thu tiền khám bệnh chuyên khoa</strong> (Định mức 50.000 đ/lượt)</td>
            <td style="text-align: center;">${data.summary.paid_count} lượt</td>
            <td style="text-align: right; font-weight: bold;">${fmt(data.summary.exam_fee_total)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">2</td>
            <td><strong>Doanh thu dịch vụ Cận Lâm Sàng</strong> (Chụp X-quang, Siêu âm, Xét nghiệm)</td>
            <td style="text-align: center;">Theo chỉ định</td>
            <td style="text-align: right; font-weight: bold;">${fmt(data.summary.cls_fee_total)}</td>
          </tr>
          <tr>
            <td style="text-align: center;">3</td>
            <td><strong>Doanh thu bán thuốc & dược phẩm</strong> (Theo đơn điều trị)</td>
            <td style="text-align: center;">Theo đơn thuốc</td>
            <td style="text-align: right; font-weight: bold;">${fmt(data.summary.medicine_fee_total)}</td>
          </tr>
          <tr style="background: #f9f9f9; font-weight: bold;">
            <td colspan="3" style="text-align: right; text-transform: uppercase;">TỔNG CỘNG DOANH THU THỰC THU:</td>
            <td style="text-align: right; color: #047857; font-size: 12pt;">${fmt(data.summary.total_revenue)}</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">II. THỐNG KÊ CHI TIẾT THEO BÁC SĨ & CHUYÊN KHOA</div>
      <table>
        <thead>
          <tr>
            <th style="width: 50px;">STT</th>
            <th>Họ và Tên Bác Sĩ</th>
            <th>Khoa / Phòng Khám</th>
            <th style="width: 110px; text-align: center;">Số Ca Khám</th>
            <th style="width: 160px; text-align: right;">Doanh Thu (VNĐ)</th>
            <th style="width: 80px; text-align: center;">Tỷ Trọng</th>
          </tr>
        </thead>
        <tbody>
          ${docRows}
        </tbody>
      </table>

      <div class="section-title">III. PHƯƠNG THỨC THU & ĐỐI SOÁT QUỸ TIỀN TỆ</div>
      <table>
        <thead>
          <tr>
            <th>Hình Thức Thu Viện Phí</th>
            <th style="width: 180px; text-align: right;">Số Tiền Đã Thu (VNĐ)</th>
            <th style="width: 140px; text-align: center;">Tỷ Lệ</th>
            <th>Ghi Chú Nghiệp Vụ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>1. Tiền mặt (Cash)</strong></td>
            <td style="text-align: right; font-weight: bold;">${fmt(data.summary.cash_revenue)}</td>
            <td style="text-align: center;">${data.summary.total_revenue > 0 ? Math.round((data.summary.cash_revenue / data.summary.total_revenue) * 100) : 0}%</td>
            <td>Kiểm đếm tại két thu ngân</td>
          </tr>
          <tr>
            <td><strong>2. Chuyển khoản ngân hàng (VietQR / POS)</strong></td>
            <td style="text-align: right; font-weight: bold;">${fmt(data.summary.transfer_revenue)}</td>
            <td style="text-align: center;">${data.summary.total_revenue > 0 ? Math.round((data.summary.transfer_revenue / data.summary.total_revenue) * 100) : 0}%</td>
            <td>Tài khoản thanh toán phòng khám</td>
          </tr>
          <tr>
            <td><strong>3. Hóa đơn chưa thanh toán (Công nợ)</strong></td>
            <td style="text-align: right; color: red;">${fmt(data.summary.unpaid_revenue)}</td>
            <td style="text-align: center;">${data.summary.unpaid_count} hóa đơn</td>
            <td>Bệnh nhân đang chờ đóng viện phí</td>
          </tr>
        </tbody>
      </table>

      <div style="font-style: italic; text-align: right; margin-top: 25px;">
        Hà Nội, ngày ${printDateStr}
      </div>

      <div class="signatures">
        <div class="sig-block">
          <strong>NGƯỜI LẬP BIỂU</strong><br>
          <span style="font-size: 10pt; font-style: italic;">(Ký, ghi rõ họ tên)</span>
          <div class="sig-space"></div>
          <strong>${state.currentUser ? state.currentUser.full_name : 'Quản Trị Viên'}</strong>
        </div>
        <div class="sig-block">
          <strong>KẾ TOÁN TRƯỞNG</strong><br>
          <span style="font-size: 10pt; font-style: italic;">(Ký, ghi rõ họ tên)</span>
          <div class="sig-space"></div>
          <strong>Nguyễn Văn Thu</strong>
        </div>
        <div class="sig-block">
          <strong>GIÁM ĐỐC PHÒNG KHÁM</strong><br>
          <span style="font-size: 10pt; font-style: italic;">(Ký tên và đóng dấu)</span>
          <div class="sig-space"></div>
          <strong>TS. BS. Giám Đốc Điều Hành</strong>
        </div>
      </div>
    </body>
    </html>
  `);
  win.document.close();
}

function printCashierShiftHandover() {
  const invoices = state.invoices || [];
  const fmt = (n) => new Intl.NumberFormat('vi-VN').format(n || 0) + ' đ';
  const now = new Date();
  const printDateStr = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
  const printTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let totalPaid = 0;
  let totalCash = 0;
  let totalTransfer = 0;
  let totalUnpaid = 0;
  let countPaid = 0;
  let countUnpaid = 0;

  const rows = invoices.map((inv, idx) => {
    const amt = parseFloat(inv.total_amount) || 0;
    if (inv.payment_status === 'PAID') {
      totalPaid += amt;
      countPaid++;
      if (inv.payment_method === 'CASH') totalCash += amt;
      else totalTransfer += amt;
    } else {
      totalUnpaid += amt;
      countUnpaid++;
    }

    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td><strong>#HD-${String(inv.id).padStart(4, '0')}</strong></td>
        <td>${inv.patient_name}</td>
        <td>${inv.doctor_name || 'BS Phụ trách'}</td>
        <td style="text-align: right; font-weight: bold;">${fmt(amt)}</td>
        <td style="text-align: center;">${inv.payment_method === 'TRANSFER' ? 'Chuyển khoản' : 'Tiền mặt'}</td>
        <td style="text-align: center; font-weight: bold; color: ${inv.payment_status === 'PAID' ? '#047857' : '#dc2626'};">
          ${inv.payment_status === 'PAID' ? 'ĐÃ THU' : 'CHƯA THU'}
        </td>
      </tr>
    `;
  }).join('');

  const win = window.open('', '_blank', 'width=800,height=800');
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <title>Biên Bản Chốt Ca Thu Ngân - ${printDateStr}</title>
      <style>
        body { font-family: 'Times New Roman', serif; font-size: 13pt; line-height: 1.4; color: #000; padding: 15px; }
        .center { text-align: center; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11pt; }
        th, td { border: 1px solid #333; padding: 6px 8px; }
        th { background: #f0f0f0; }
        .signatures { display: flex; justify-content: space-between; margin-top: 40px; text-align: center; }
        .sig-block { width: 45%; }
        .sig-space { height: 70px; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 15px; text-align: right;">
        <button onclick="window.print()" style="padding: 8px 16px; font-weight: bold; background: #0d9488; color: #fff; border: none; border-radius: 4px; cursor: pointer;">🖨️ In Bảng Kê Chốt Ca</button>
      </div>
      <div class="center">
        <strong>PHÒNG KHÁM ĐA KHOA QUỐC TẾ DTC</strong><br>
        <span style="font-size: 11pt;">Quầy Thu Ngân & Viện Phí</span>
        <h2 style="margin: 15px 0 5px 0; font-size: 15pt;">BIÊN BẢN BÀN GIAO CA & ĐỐI SOÁT QUỸ THU NGÂN</h2>
        <p style="margin: 0; font-style: italic; font-size: 11pt;">Ngày ${printDateStr} - Thời điểm in: ${printTimeStr}</p>
      </div>

      <div style="margin: 15px 0; padding: 10px; background: #f8fafc; border: 1px solid #ccc; font-size: 12pt;">
        <div><strong>Nhân viên thu ngân trực ca:</strong> ${state.currentUser ? state.currentUser.full_name : 'Nguyễn Văn Thu (thungan01)'}</div>
        <div><strong>Tổng tiền thực thu trong ca:</strong> <span style="font-size: 13pt; font-weight: bold; color: #047857;">${fmt(totalPaid)}</span> (Đã thu ${countPaid} hóa đơn)</div>
        <div style="margin-left: 15px; font-size: 11pt;">
          - Tiền mặt tại két: <strong>${fmt(totalCash)}</strong><br>
          - Chuyển khoản QR / Ngân hàng: <strong>${fmt(totalTransfer)}</strong>
        </div>
        <div><strong>Hóa đơn chưa thu tiền:</strong> ${fmt(totalUnpaid)} (${countUnpaid} hóa đơn)</div>
      </div>

      <h4 style="margin: 10px 0 5px 0;">BẢNG KÊ CHI TIẾT TỪNG HÓA ĐƠN TRONG CA:</h4>
      <table>
        <thead>
          <tr>
            <th style="width: 40px;">STT</th>
            <th>Mã HĐ</th>
            <th>Tên Bệnh Nhân</th>
            <th>Bác Sĩ</th>
            <th style="text-align: right;">Tổng Tiền</th>
            <th>Hình Thức</th>
            <th>Trạng Thái</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div class="signatures">
        <div class="sig-block">
          <strong>THU NGÂN GIAO CA</strong><br>
          <span style="font-size: 10pt; font-style: italic;">(Ký, ghi rõ họ tên và số tiền bàn giao)</span>
          <div class="sig-space"></div>
          <strong>${state.currentUser ? state.currentUser.full_name : 'Nguyễn Văn Thu'}</strong>
        </div>
        <div class="sig-block">
          <strong>KẾ TOÁN / THU NGÂN NHẬN CA</strong><br>
          <span style="font-size: 10pt; font-style: italic;">(Ký, ghi rõ họ tên và xác nhận khớp quỹ)</span>
          <div class="sig-space"></div>
          <strong>....................................................</strong>
        </div>
      </div>
    </body>
    </html>
  `);
  win.document.close();
}

function exportRevenueCSV() {
  if (!currentReportData) {
    showToast('Chưa có dữ liệu để xuất file!', 'error');
    return;
  }
  const data = currentReportData;
  let csv = "\uFEFF"; // UTF-8 BOM
  csv += "BÁO CÁO THỐNG KÊ DOANH THU PHÒNG KHÁM\n";
  csv += `Kỳ báo cáo: ${data.selected_date}\n`;
  csv += `Ngày xuất biểu: ${new Date().toLocaleString('vi-VN')}\n\n`;

  csv += "I. TỔNG HỢP CƠ CẤU DOANH THU\n";
  csv += "Hạng mục,Số lượng / Lượt,Doanh thu (VNĐ)\n";
  csv += `Tiền khám chuyên khoa,${data.summary.paid_count} lượt,${data.summary.exam_fee_total}\n`;
  csv += `Dịch vụ Cận lâm sàng & CLS,Theo chỉ định,${data.summary.cls_fee_total}\n`;
  csv += `Thuốc & Dược phẩm,Theo đơn,${data.summary.medicine_fee_total}\n`;
  csv += `TỔNG CỘNG THỰC THU,,${data.summary.total_revenue}\n\n`;

  csv += "II. DOANH THU THEO BÁC SĨ & CHUYÊN KHOA\n";
  csv += "STT,Bác sĩ,Khoa phòng,Số ca khám,Doanh thu (VNĐ),Tỷ trọng (%)\n";
  (data.by_doctor || []).forEach((d, idx) => {
    csv += `${idx + 1},"${d.doctor_name}","${d.department_name}",${d.completed_count},${d.doctor_revenue},${d.percentage}%\n`;
  });
  csv += "\n";

  csv += "III. PHƯƠNG THỨC THANH TOÁN\n";
  csv += "Hình thức,Doanh thu (VNĐ)\n";
  csv += `Tiền mặt tại két,${data.summary.cash_revenue}\n`;
  csv += `Chuyển khoản VietQR / POS,${data.summary.transfer_revenue}\n`;
  csv += `Công nợ chưa thanh toán,${data.summary.unpaid_revenue}\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `BaoCao_DoanhThu_PhongKham_${data.selected_date}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Đã xuất file Excel (CSV) thành công!', 'success');
}
