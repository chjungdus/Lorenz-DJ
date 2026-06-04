// admin.js – Edmund Panel

let supabase;
let allBookings   = [];
let allBlocked    = [];   // ['YYYY-MM-DD', ...]
let currentYear, currentMonth;
let selectedDate  = null;
let currentFilter = 'all';

// ── UNLOCK / LOGOUT ───────────────────────────────────────

function unlockDashboard() {
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    var err = document.getElementById('gate-error');
    if (err) { err.textContent = 'Verbindungsfehler – Seite neu laden.'; err.style.display = 'block'; }
    console.error(e);
    return;
  }
  document.getElementById('admin-gate').style.display      = 'none';
  document.getElementById('admin-dashboard').style.display = 'block';
  sessionStorage.setItem('lorenz-admin', '1');

  const now = new Date();
  currentYear  = now.getFullYear();
  currentMonth = now.getMonth();
  loadAll();
}

function logout() {
  sessionStorage.removeItem('lorenz-admin');
  location.reload();
}

// Logout button
var logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) logoutBtn.addEventListener('click', logout);

// Tab switching
document.getElementById('admin-tabs').addEventListener('click', function (e) {
  var btn = e.target.closest('.tab-btn');
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
});

// Month navigation
document.getElementById('prev-month').addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
});
document.getElementById('next-month').addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
});

// Filter buttons (list tab)
document.getElementById('filter-bar').addEventListener('click', function (e) {
  var btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.filter;
  renderTable();
});

// Block/unblock button
document.getElementById('block-btn').addEventListener('click', function () {
  if (!selectedDate) return;
  toggleBlockDate(selectedDate);
});

// Mobile backdrop
document.getElementById('detail-backdrop').addEventListener('click', function () {
  document.getElementById('day-detail').classList.remove('open');
  this.classList.add('hidden');
});

// Session still active?
if (sessionStorage.getItem('lorenz-admin') === '1') unlockDashboard();

// ── DATEN LADEN ───────────────────────────────────────────

async function loadAll() {
  const [bRes, dRes] = await Promise.all([
    supabase.from('bookings').select('*').order('event_date', { ascending: true }),
    supabase.from('blocked_dates').select('date')
  ]);

  if (bRes.error) console.error('bookings:', bRes.error);
  if (dRes.error) console.error('blocked_dates:', dRes.error);

  allBookings = bRes.data || [];
  allBlocked  = (dRes.data || []).map(r => r.date);

  updateStats();
  renderCalendar();
  renderTable();
}

// ── STATISTIKEN ───────────────────────────────────────────

function updateStats() {
  document.getElementById('stat-total').textContent     = allBookings.length;
  document.getElementById('stat-pending').textContent   = allBookings.filter(b => b.status === 'pending').length;
  document.getElementById('stat-confirmed').textContent = allBookings.filter(b => b.status === 'confirmed').length;
  document.getElementById('stat-cancelled').textContent = allBookings.filter(b => b.status === 'cancelled').length;
}

// ── KALENDER RENDERN ──────────────────────────────────────

function renderCalendar() {
  const grid  = document.getElementById('admin-cal-grid');
  const label = document.getElementById('month-label');

  const monthNames = ['Januar','Februar','März','April','Mai','Juni',
                      'Juli','August','September','Oktober','November','Dezember'];
  label.textContent = `${monthNames[currentMonth]} ${currentYear}`;

  const firstDay   = new Date(currentYear, currentMonth, 1);
  let startOffset  = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today       = new Date();

  const bookingMap = {};
  allBookings.forEach(b => {
    if (!bookingMap[b.event_date]) bookingMap[b.event_date] = [];
    bookingMap[b.event_date].push(b);
  });

  grid.innerHTML = '';

  for (let i = 0; i < startOffset; i++) {
    grid.insertAdjacentHTML('beforeend', '<div class="cal-cell empty"></div>');
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const mm      = String(currentMonth + 1).padStart(2, '0');
    const dd      = String(d).padStart(2, '0');
    const dateStr = `${currentYear}-${mm}-${dd}`;
    const dayBk   = bookingMap[dateStr] || [];
    const isBlocked  = allBlocked.includes(dateStr);
    const isToday    = today.getFullYear() === currentYear &&
                       today.getMonth()    === currentMonth &&
                       today.getDate()     === d;
    const weekday   = new Date(currentYear, currentMonth, d).getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const isSelected = dateStr === selectedDate;

    const dotsHtml = dayBk.slice(0, 3).map(b =>
      `<span class="dot dot-${b.status}"></span>`
    ).join('');
    const extraCount = dayBk.length > 3
      ? `<span class="dot-extra">+${dayBk.length - 3}</span>`
      : '';

    const cell = document.createElement('div');
    cell.className = 'cal-cell' +
      (isToday    ? ' today'    : '') +
      (isWeekend  ? ' weekend'  : '') +
      (isBlocked  ? ' blocked'  : '') +
      (isSelected ? ' selected' : '');

    cell.innerHTML = `<span class="day-num">${d}</span>` +
      (isBlocked
        ? '<span class="blocked-x">✕</span>'
        : `<div class="dot-row">${dotsHtml}${extraCount}</div>`);

    cell.addEventListener('click', () => selectDay(dateStr));
    grid.appendChild(cell);
  }
}

// ── TAG AUSWÄHLEN ─────────────────────────────────────────

function selectDay(dateStr) {
  selectedDate = dateStr;
  renderCalendar();

  const [y, m, d] = dateStr.split('-');
  document.getElementById('detail-date-heading').textContent = `${d}.${m}.${y}`;

  const isBlocked = allBlocked.includes(dateStr);
  const blockBtn  = document.getElementById('block-btn');
  blockBtn.style.display  = '';
  blockBtn.textContent    = isBlocked ? '🔓 Freigeben' : '🔒 Sperren';
  blockBtn.classList.toggle('is-blocked', isBlocked);

  renderDayDetail(dateStr);

  // Mobile: open sliding panel
  document.getElementById('day-detail').classList.add('open');
  document.getElementById('detail-backdrop').classList.remove('hidden');
}

// ── DAY DETAIL ────────────────────────────────────────────

function renderDayDetail(dateStr) {
  const body      = document.getElementById('day-detail-body');
  const dayBk     = allBookings.filter(b => b.event_date === dateStr);
  const isBlocked = allBlocked.includes(dateStr);

  if (isBlocked && dayBk.length === 0) {
    body.innerHTML = '<div class="blocked-notice">🔒 Dieser Tag ist gesperrt – keine Buchungen.</div>';
    return;
  }

  if (dayBk.length === 0) {
    body.innerHTML = '<p class="detail-hint">Keine Buchungen für diesen Tag.</p>';
    return;
  }

  body.innerHTML = dayBk.map(b => `
    <div class="booking-card status-left-${b.status}" id="card-${b.id}">
      <div class="booking-card-top">
        <div>
          <div class="booking-name">${esc(b.name)}</div>
          <span class="status-badge status-${b.status}">${statusLabel(b.status)}</span>
        </div>
        <span class="booking-price">${estimatePrice(b.guest_count)}</span>
      </div>
      <div class="booking-info">
        <div class="booking-info-item">
          <label>Uhrzeit</label>
          <span>${b.event_time ? b.event_time.slice(0,5) + (b.event_time_end ? ' – ' + b.event_time_end.slice(0,5) : '') : '–'}</span>
        </div>
        <div class="booking-info-item">
          <label>Personen</label>
          <span>${b.guest_count}</span>
        </div>
        <div class="booking-info-item">
          <label>E-Mail</label>
          <span><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></span>
        </div>
        <div class="booking-info-item">
          <label>Telefon</label>
          <span><a href="tel:${esc(b.phone)}">${esc(b.phone)}</a></span>
        </div>
        ${b.event_location ? `
        <div class="booking-info-item span-2">
          <label>Veranstaltungsort</label>
          <span>${esc(b.event_location)}</span>
        </div>` : ''}
      </div>
      ${b.message ? `<div class="booking-msg">"${esc(b.message)}"</div>` : ''}
      <div class="booking-actions">
        <button class="action-btn btn-confirm" onclick="updateBookingStatus('${b.id}','confirmed')" ${b.status==='confirmed'?'disabled':''}>✓ Bestätigen</button>
        <button class="action-btn btn-reject"  onclick="updateBookingStatus('${b.id}','cancelled')" ${b.status==='cancelled'?'disabled':''}>✕ Ablehnen</button>
        <button class="action-btn btn-reset"   onclick="updateBookingStatus('${b.id}','pending')"   ${b.status==='pending'?'disabled':''}>↺ Zurücksetzen</button>
      </div>
    </div>
  `).join('');
}

// ── STATUS ÄNDERN ─────────────────────────────────────────

async function updateBookingStatus(id, newStatus) {
  const { error } = await supabase
    .from('bookings')
    .update({ status: newStatus })
    .eq('id', id);

  if (error) { console.error(error); return; }

  const b = allBookings.find(b => b.id === id);
  if (b) b.status = newStatus;

  updateStats();
  renderCalendar();
  if (selectedDate) renderDayDetail(selectedDate);
  renderTable();
}

// ── TAG SPERREN / FREIGEBEN ───────────────────────────────

async function toggleBlockDate(dateStr) {
  const isBlocked = allBlocked.includes(dateStr);

  if (isBlocked) {
    const { error } = await supabase.from('blocked_dates').delete().eq('date', dateStr);
    if (error) { console.error(error); return; }
    allBlocked = allBlocked.filter(d => d !== dateStr);
  } else {
    const { error } = await supabase.from('blocked_dates').insert([{ date: dateStr }]);
    if (error) { console.error(error); return; }
    allBlocked.push(dateStr);
  }

  renderCalendar();
  if (selectedDate === dateStr) {
    const nowBlocked = allBlocked.includes(dateStr);
    const blockBtn   = document.getElementById('block-btn');
    blockBtn.textContent = nowBlocked ? '🔓 Freigeben' : '🔒 Sperren';
    blockBtn.classList.toggle('is-blocked', nowBlocked);
    renderDayDetail(dateStr);
  }
}

// ── PREISSCHÄTZUNG ────────────────────────────────────────

function estimatePrice(n) {
  if (!n) return '–';
  if (n <= 30)  return '~150–200 €';
  if (n <= 80)  return '~200–350 €';
  if (n <= 150) return '~350–500 €';
  return '500+ €';
}

// ── TABELLE RENDERN ───────────────────────────────────────

function renderTable() {
  const rows  = currentFilter === 'all' ? allBookings : allBookings.filter(b => b.status === currentFilter);
  const tbody = document.getElementById('bookings-body');
  const table = document.getElementById('bookings-table');
  const empty = document.getElementById('admin-empty');
  const loading = document.getElementById('admin-loading');

  if (loading) loading.style.display = 'none';

  if (rows.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  table.style.display = 'table';
  empty.style.display = 'none';

  tbody.innerHTML = rows.map(b => `
    <tr>
      <td class="td-date">${formatDate(b.event_date)}</td>
      <td class="td-name">${esc(b.name)}</td>
      <td><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></td>
      <td><a href="tel:${esc(b.phone)}">${esc(b.phone)}</a></td>
      <td>${b.event_time ? b.event_time.slice(0,5) + (b.event_time_end ? ' – ' + b.event_time_end.slice(0,5) : '') : '–'}</td>
      <td class="td-center">${b.guest_count}</td>
      <td>${b.event_location ? esc(b.event_location) : '<span class="muted">–</span>'}</td>
      <td class="td-msg" title="${b.message ? esc(b.message) : ''}">${b.message ? esc(b.message) : '<span class="muted">–</span>'}</td>
      <td><span class="status-badge status-${esc(b.status)}">${statusLabel(b.status)}</span></td>
      <td class="td-date">${formatDateTime(b.created_at)}</td>
    </tr>
  `).join('');
}

// ── HILFSFUNKTIONEN ───────────────────────────────────────

function formatDate(str) {
  if (!str) return '–';
  const [y, m, d] = str.split('-');
  return `${d}.${m}.${y}`;
}

function formatDateTime(str) {
  if (!str) return '–';
  return new Date(str).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function statusLabel(s) {
  return { pending: 'Ausstehend', confirmed: 'Bestätigt', cancelled: 'Abgelehnt' }[s] ?? s;
}

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
