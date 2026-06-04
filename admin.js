// admin.js – Edmund Panel (robust rewrite)

let supabase = null;
let allBookings   = [];
let allBlocked    = [];
let selectedDate  = null;
let currentFilter = 'all';

const now = new Date();
let currentYear  = now.getFullYear();
let currentMonth = now.getMonth();

// ── INIT ─────────────────────────────────────────────────

function unlockDashboard() {
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    var err = document.getElementById('gate-error');
    if (err) { err.textContent = 'Verbindungsfehler: ' + e.message; err.style.display = 'block'; }
    return;
  }

  document.getElementById('admin-gate').style.display      = 'none';
  document.getElementById('admin-dashboard').style.display = 'block';
  sessionStorage.setItem('lorenz-admin', '1');

  renderCalendar(); // show calendar structure immediately
  loadAll();        // then fill with data
}

function logout() {
  sessionStorage.removeItem('lorenz-admin');
  location.reload();
}

// Auto-unlock from session
if (sessionStorage.getItem('lorenz-admin') === '1') {
  window.addEventListener('load', function () {
    unlockDashboard();
  });
}

// ── DATEN LADEN ───────────────────────────────────────────

async function loadAll() {
  setStatus('Buchungen werden geladen …');

  // Bookings
  try {
    const bRes = await supabase
      .from('bookings')
      .select('*')
      .order('event_date', { ascending: true });

    if (bRes.error) {
      setStatus('Fehler beim Laden: ' + bRes.error.message, true);
      console.error('bookings:', bRes.error);
    } else {
      allBookings = bRes.data || [];
    }
  } catch (e) {
    setStatus('Netzwerkfehler: ' + e.message, true);
    console.error(e);
  }

  // Blocked dates (separate query so booking errors don't block this)
  try {
    const dRes = await supabase.from('blocked_dates').select('date');
    if (!dRes.error) {
      allBlocked = (dRes.data || []).map(r => r.date);
    }
  } catch (e) {
    console.error('blocked_dates:', e);
  }

  setStatus('');
  updateStats();
  renderCalendar();
  renderTable();
}

function setStatus(msg, isError) {
  var el = document.getElementById('admin-status');
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
  el.style.color = isError ? '#F87171' : 'var(--text-muted)';
}

// ── STATS ─────────────────────────────────────────────────

function updateStats() {
  document.getElementById('stat-total').textContent     = allBookings.length;
  document.getElementById('stat-pending').textContent   = allBookings.filter(b => b.status === 'pending').length;
  document.getElementById('stat-confirmed').textContent = allBookings.filter(b => b.status === 'confirmed').length;
  document.getElementById('stat-cancelled').textContent = allBookings.filter(b => b.status === 'cancelled').length;
}

// ── TABS ──────────────────────────────────────────────────

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.querySelector('[data-tab="' + tab + '"]').classList.add('active');
  document.getElementById('tab-' + tab).classList.remove('hidden');
}

// ── KALENDER ──────────────────────────────────────────────

function prevMonth() {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendar();
}

function nextMonth() {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendar();
}

function renderCalendar() {
  var grid  = document.getElementById('admin-cal-grid');
  var label = document.getElementById('month-label');
  if (!grid || !label) return;

  var monthNames = ['Januar','Februar','März','April','Mai','Juni',
                    'Juli','August','September','Oktober','November','Dezember'];
  label.textContent = monthNames[currentMonth] + ' ' + currentYear;

  var firstDay   = new Date(currentYear, currentMonth, 1);
  var startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
  var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  var today        = new Date();

  var bookingMap = {};
  allBookings.forEach(function(b) {
    if (!bookingMap[b.event_date]) bookingMap[b.event_date] = [];
    bookingMap[b.event_date].push(b);
  });

  var html = '';

  // Empty cells
  for (var i = 0; i < startOffset; i++) {
    html += '<div class="cal-cell empty"></div>';
  }

  // Day cells
  for (var d = 1; d <= daysInMonth; d++) {
    var mm = (currentMonth + 1 < 10 ? '0' : '') + (currentMonth + 1);
    var dd = (d < 10 ? '0' : '') + d;
    var dateStr = currentYear + '-' + mm + '-' + dd;
    var dayBk   = bookingMap[dateStr] || [];
    var blocked  = allBlocked.indexOf(dateStr) !== -1;
    var isToday  = today.getFullYear() === currentYear && today.getMonth() === currentMonth && today.getDate() === d;
    var weekday  = new Date(currentYear, currentMonth, d).getDay();
    var weekend  = weekday === 0 || weekday === 6;
    var selected = dateStr === selectedDate;

    var cls = 'cal-cell';
    if (isToday)  cls += ' today';
    if (weekend)  cls += ' weekend';
    if (blocked)  cls += ' blocked';
    if (selected) cls += ' selected';

    var inner = '<span class="day-num">' + d + '</span>';
    if (blocked) {
      inner += '<span class="blocked-x">✕</span>';
    } else if (dayBk.length > 0) {
      var dots = '';
      dayBk.slice(0, 3).forEach(function(b) {
        dots += '<span class="dot dot-' + b.status + '"></span>';
      });
      if (dayBk.length > 3) dots += '<span class="dot-extra">+' + (dayBk.length - 3) + '</span>';
      inner += '<div class="dot-row">' + dots + '</div>';
    }

    html += '<div class="' + cls + '" onclick="selectDay(\'' + dateStr + '\')">' + inner + '</div>';
  }

  grid.innerHTML = html;
}

// ── TAG AUSWÄHLEN ─────────────────────────────────────────

function selectDay(dateStr) {
  selectedDate = dateStr;
  renderCalendar();

  var parts = dateStr.split('-');
  document.getElementById('detail-date-heading').textContent = parts[2] + '.' + parts[1] + '.' + parts[0];

  var blocked = allBlocked.indexOf(dateStr) !== -1;
  var btn = document.getElementById('block-btn');
  btn.style.display = '';
  btn.textContent   = blocked ? '🔓 Freigeben' : '🔒 Sperren';
  btn.className     = 'block-btn' + (blocked ? ' is-blocked' : '');

  renderDayDetail(dateStr);

  // Mobile: slide up
  document.getElementById('day-detail').classList.add('open');
  document.getElementById('detail-backdrop').classList.remove('hidden');
}

function closeDetail() {
  document.getElementById('day-detail').classList.remove('open');
  document.getElementById('detail-backdrop').classList.add('hidden');
}

// ── DAY DETAIL ────────────────────────────────────────────

function renderDayDetail(dateStr) {
  var body   = document.getElementById('day-detail-body');
  var dayBk  = allBookings.filter(function(b) { return b.event_date === dateStr; });
  var blocked = allBlocked.indexOf(dateStr) !== -1;

  if (blocked && dayBk.length === 0) {
    body.innerHTML = '<div class="blocked-notice">🔒 Dieser Tag ist gesperrt.</div>';
    return;
  }
  if (dayBk.length === 0) {
    body.innerHTML = '<p class="detail-hint">Keine Buchungen für diesen Tag.</p>';
    return;
  }

  body.innerHTML = dayBk.map(function(b) {
    return '<div class="booking-card status-left-' + b.status + '">' +
      '<div class="booking-card-top">' +
        '<div>' +
          '<div class="booking-name">' + esc(b.name) + '</div>' +
          '<span class="status-badge status-' + b.status + '">' + statusLabel(b.status) + '</span>' +
        '</div>' +
        '<span class="booking-price">' + estimatePrice(b.guest_count) + '</span>' +
      '</div>' +
      '<div class="booking-info">' +
        '<div class="booking-info-item">' +
          '<label>Uhrzeit</label>' +
          '<span>' + (b.event_time ? b.event_time.slice(0,5) + (b.event_time_end ? ' – ' + b.event_time_end.slice(0,5) : '') : '–') + '</span>' +
        '</div>' +
        '<div class="booking-info-item">' +
          '<label>Personen</label><span>' + b.guest_count + '</span>' +
        '</div>' +
        '<div class="booking-info-item">' +
          '<label>E-Mail</label><span><a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a></span>' +
        '</div>' +
        '<div class="booking-info-item">' +
          '<label>Telefon</label><span><a href="tel:' + esc(b.phone) + '">' + esc(b.phone) + '</a></span>' +
        '</div>' +
        (b.event_location ? '<div class="booking-info-item span-2"><label>Veranstaltungsort</label><span>' + esc(b.event_location) + '</span></div>' : '') +
      '</div>' +
      (b.message ? '<div class="booking-msg">"' + esc(b.message) + '"</div>' : '') +
      '<div class="booking-actions">' +
        '<button class="action-btn btn-confirm" onclick="updateBookingStatus(\'' + b.id + '\',\'confirmed\')" ' + (b.status === 'confirmed' ? 'disabled' : '') + '>✓ Bestätigen</button>' +
        '<button class="action-btn btn-reject"  onclick="updateBookingStatus(\'' + b.id + '\',\'cancelled\')" ' + (b.status === 'cancelled' ? 'disabled' : '') + '>✕ Ablehnen</button>' +
        '<button class="action-btn btn-reset"   onclick="updateBookingStatus(\'' + b.id + '\',\'pending\')"   ' + (b.status === 'pending'   ? 'disabled' : '') + '>↺ Zurücksetzen</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ── STATUS ÄNDERN ─────────────────────────────────────────

async function updateBookingStatus(id, newStatus) {
  var res = await supabase.from('bookings').update({ status: newStatus }).eq('id', id);
  if (res.error) { console.error(res.error); return; }
  allBookings.forEach(function(b) { if (b.id === id) b.status = newStatus; });
  updateStats();
  renderCalendar();
  if (selectedDate) renderDayDetail(selectedDate);
  renderTable();
}

// ── TAG SPERREN ───────────────────────────────────────────

function toggleBlock() {
  if (!selectedDate) return;
  toggleBlockDate(selectedDate);
}

async function toggleBlockDate(dateStr) {
  var blocked = allBlocked.indexOf(dateStr) !== -1;
  if (blocked) {
    var r = await supabase.from('blocked_dates').delete().eq('date', dateStr);
    if (r.error) { console.error(r.error); return; }
    allBlocked = allBlocked.filter(function(d) { return d !== dateStr; });
  } else {
    var r2 = await supabase.from('blocked_dates').insert([{ date: dateStr }]);
    if (r2.error) { console.error(r2.error); return; }
    allBlocked.push(dateStr);
  }
  var nowBlocked = allBlocked.indexOf(dateStr) !== -1;
  var btn = document.getElementById('block-btn');
  btn.textContent = nowBlocked ? '🔓 Freigeben' : '🔒 Sperren';
  btn.className   = 'block-btn' + (nowBlocked ? ' is-blocked' : '');
  renderCalendar();
  if (selectedDate === dateStr) renderDayDetail(dateStr);
}

// ── PREISSCHÄTZUNG ────────────────────────────────────────

function estimatePrice(n) {
  n = parseInt(n, 10);
  if (!n)    return '–';
  if (n <= 30)  return '~150–200 €';
  if (n <= 80)  return '~200–350 €';
  if (n <= 150) return '~350–500 €';
  return '500+ €';
}

// ── TABELLE ───────────────────────────────────────────────

function filterTable(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  renderTable();
}

function renderTable() {
  var rows  = currentFilter === 'all' ? allBookings : allBookings.filter(function(b) { return b.status === currentFilter; });
  var tbody = document.getElementById('bookings-body');
  var table = document.getElementById('bookings-table');
  var empty = document.getElementById('admin-empty');
  var loading = document.getElementById('admin-loading');
  if (loading) loading.style.display = 'none';

  if (rows.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  table.style.display = '';
  empty.style.display = 'none';

  tbody.innerHTML = rows.map(function(b) {
    return '<tr>' +
      '<td class="td-date">' + formatDate(b.event_date) + '</td>' +
      '<td class="td-name">' + esc(b.name) + '</td>' +
      '<td><a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a></td>' +
      '<td><a href="tel:' + esc(b.phone) + '">' + esc(b.phone) + '</a></td>' +
      '<td>' + (b.event_time ? b.event_time.slice(0,5) + (b.event_time_end ? ' – ' + b.event_time_end.slice(0,5) : '') : '–') + '</td>' +
      '<td class="td-center">' + b.guest_count + '</td>' +
      '<td>' + (b.event_location ? esc(b.event_location) : '<span class="muted">–</span>') + '</td>' +
      '<td class="td-msg" title="' + (b.message ? esc(b.message) : '') + '">' + (b.message ? esc(b.message) : '<span class="muted">–</span>') + '</td>' +
      '<td><span class="status-badge status-' + esc(b.status) + '">' + statusLabel(b.status) + '</span></td>' +
      '<td class="td-date">' + formatDateTime(b.created_at) + '</td>' +
    '</tr>';
  }).join('');
}

// ── HILFSFUNKTIONEN ───────────────────────────────────────

function formatDate(str) {
  if (!str) return '–';
  var p = str.split('-');
  return p[2] + '.' + p[1] + '.' + p[0];
}

function formatDateTime(str) {
  if (!str) return '–';
  return new Date(str).toLocaleDateString('de-DE');
}

function statusLabel(s) {
  return ({ pending: 'Ausstehend', confirmed: 'Bestätigt', cancelled: 'Abgelehnt' })[s] || s;
}

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
