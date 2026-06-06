// admin.js – Edmund Panel (clean rewrite)

// ── GLOBAL STATE ──────────────────────────────────────────
var _sb          = null;
var allBookings  = [];
var allBlocked   = [];
var selectedDate = null;
var curFilter    = 'all';

var _now     = new Date();
var curYear  = _now.getFullYear();
var curMonth = _now.getMonth(); // 0-based

// ── HELPERS ───────────────────────────────────────────────

function pad2(n) {
  return n < 10 ? '0' + n : '' + n;
}

function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(str) {
  if (!str) return '–';
  var p = str.split('-');
  return p[2] + '.' + p[1] + '.' + p[0];
}

function formatDateTime(str) {
  if (!str) return '–';
  try { return new Date(str).toLocaleDateString('de-DE'); } catch (e) { return str; }
}

function statusLabel(s) {
  return ({ pending: 'Ausstehend', confirmed: 'Bestätigt', cancelled: 'Abgelehnt' })[s] || s;
}

function estimatePrice(n) {
  n = parseInt(n, 10);
  if (!n)       return '–';
  if (n <= 30)  return '~150–200 €';
  if (n <= 80)  return '~200–350 €';
  if (n <= 150) return '~350–500 €';
  return '500+ €';
}

// ── STATUS BANNER ─────────────────────────────────────────

function showInfo(msg) {
  var el = document.getElementById('admin-status');
  if (!el) return;
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
  el.style.background = 'var(--surface)';
  el.style.color      = 'var(--text-muted)';
  el.style.borderLeft = 'none';
}

function showError(msg) {
  var el = document.getElementById('admin-status');
  if (!el) { console.error('[admin]', msg); return; }
  el.textContent = msg || '';
  el.style.display    = msg ? 'block' : 'none';
  el.style.background = 'rgba(239,68,68,0.12)';
  el.style.color      = '#F87171';
  el.style.borderLeft = '3px solid #EF4444';
  el.style.padding    = '10px 16px';
  el.style.borderRadius = '8px';
  console.error('[admin]', msg);
}

// ── LOGIN ─────────────────────────────────────────────────

function unlockDashboard() {
  // 1. Supabase CDN check
  if (typeof window.supabase === 'undefined') {
    var gErr = document.getElementById('gate-error');
    if (gErr) { gErr.textContent = 'Fehler: Supabase-CDN nicht geladen. Bitte Seite neu laden.'; gErr.style.display = 'block'; }
    return;
  }

  // 2. Create client
  try {
    _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    var gErr2 = document.getElementById('gate-error');
    if (gErr2) { gErr2.textContent = 'Verbindungsfehler: ' + e.message; gErr2.style.display = 'block'; }
    return;
  }

  // 3. Show dashboard
  document.getElementById('admin-gate').style.display      = 'none';
  document.getElementById('admin-dashboard').style.display = 'block';
  sessionStorage.setItem('lorenz-admin', '1');

  // 4. Render calendar immediately (empty), then load data
  try { renderCalendar(); } catch (e) { showError('Kalender-Fehler: ' + e.message); }
  loadAll();
}

function logout() {
  sessionStorage.removeItem('lorenz-admin');
  location.reload();
}

// Auto-session restore.
// admin.js is loaded at the bottom of <body>, so the DOM is already parsed.
// We do NOT need a load/DOMContentLoaded wrapper here.
if (sessionStorage.getItem('lorenz-admin') === '1') {
  unlockDashboard();
}

// ── DATA LOADING ──────────────────────────────────────────

async function loadAll() {
  if (!_sb) { showError('Kein Supabase-Client. Bitte neu einloggen.'); return; }
  showInfo('Buchungen werden geladen…');

  // Bookings
  try {
    var bRes = await _sb
      .from('bookings')
      .select('*')
      .order('event_date', { ascending: true });
    if (bRes.error) {
      showError('Fehler beim Laden der Buchungen: ' + bRes.error.message);
    } else {
      allBookings = bRes.data || [];
    }
  } catch (e) {
    showError('Netzwerkfehler (Buchungen): ' + e.message);
  }

  // Blocked dates — separate query so a bookings error doesn't break this
  try {
    var dRes = await _sb.from('blocked_dates').select('date');
    if (dRes.error) {
      console.warn('[admin] blocked_dates:', dRes.error.message);
    } else {
      allBlocked = (dRes.data || []).map(function (r) { return r.date; });
    }
  } catch (e) {
    console.warn('[admin] blocked_dates network error:', e.message);
  }

  showInfo('');
  updateStats();
  try { renderCalendar(); } catch (e) { showError('Kalender-Fehler: ' + e.message); }
  renderTable();
  if (selectedDate) renderDayDetail(selectedDate);
}

// ── STATS ─────────────────────────────────────────────────

function updateStats() {
  var el;
  el = document.getElementById('stat-total');     if (el) el.textContent = allBookings.length;
  el = document.getElementById('stat-pending');   if (el) el.textContent = allBookings.filter(function (b) { return b.status === 'pending'; }).length;
  el = document.getElementById('stat-confirmed'); if (el) el.textContent = allBookings.filter(function (b) { return b.status === 'confirmed'; }).length;
  el = document.getElementById('stat-cancelled'); if (el) el.textContent = allBookings.filter(function (b) { return b.status === 'cancelled'; }).length;
}

// ── TABS ──────────────────────────────────────────────────

function switchTab(tab) {
  var btns   = document.querySelectorAll('.tab-btn');
  var panels = document.querySelectorAll('.tab-panel');
  for (var i = 0; i < btns.length;   i++) btns[i].classList.remove('active');
  for (var j = 0; j < panels.length; j++) panels[j].classList.add('hidden');
  var activeBtn   = document.querySelector('[data-tab="' + tab + '"]');
  var activePanel = document.getElementById('tab-' + tab);
  if (activeBtn)   activeBtn.classList.add('active');
  if (activePanel) activePanel.classList.remove('hidden');
}

// ── CALENDAR ──────────────────────────────────────────────

function prevMonth() {
  curMonth--;
  if (curMonth < 0) { curMonth = 11; curYear--; }
  try { renderCalendar(); } catch (e) { showError('Kalender-Fehler: ' + e.message); }
}

function nextMonth() {
  curMonth++;
  if (curMonth > 11) { curMonth = 0; curYear++; }
  try { renderCalendar(); } catch (e) { showError('Kalender-Fehler: ' + e.message); }
}

function renderCalendar() {
  var grid  = document.getElementById('admin-cal-grid');
  var label = document.getElementById('month-label');
  if (!grid)  { console.warn('[admin] #admin-cal-grid not found'); return; }
  if (!label) { console.warn('[admin] #month-label not found'); return; }

  var MONTHS = ['Januar','Februar','März','April','Mai','Juni',
                'Juli','August','September','Oktober','November','Dezember'];
  label.textContent = MONTHS[curMonth] + ' ' + curYear;

  // Build date→bookings map
  var bookingMap = {};
  for (var i = 0; i < allBookings.length; i++) {
    var b = allBookings[i];
    if (!b.event_date) continue;
    if (!bookingMap[b.event_date]) bookingMap[b.event_date] = [];
    bookingMap[b.event_date].push(b);
  }

  var firstDay    = new Date(curYear, curMonth, 1);
  var startOffset = (firstDay.getDay() + 6) % 7; // Mon = 0
  var daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  var today       = new Date();
  var todayStr    = today.getFullYear() + '-' + pad2(today.getMonth() + 1) + '-' + pad2(today.getDate());

  var html = '';

  // Empty leading cells
  for (var e = 0; e < startOffset; e++) {
    html += '<div class="cal-cell empty"></div>';
  }

  // Day cells
  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr  = curYear + '-' + pad2(curMonth + 1) + '-' + pad2(d);
    var dayBooks = bookingMap[dateStr] || [];
    var isBlocked  = allBlocked.indexOf(dateStr) !== -1;
    var isToday    = dateStr === todayStr;
    var weekday    = new Date(curYear, curMonth, d).getDay();
    var isWeekend  = weekday === 0 || weekday === 6;
    var isSelected = dateStr === selectedDate;

    var cls = 'cal-cell';
    if (isToday)    cls += ' today';
    if (isWeekend)  cls += ' weekend';
    if (isBlocked)  cls += ' blocked';
    if (isSelected) cls += ' selected';

    var inner = '<span class="day-num">' + d + '</span>';

    if (isBlocked) {
      inner += '<span class="blocked-x">✕</span>';
    } else if (dayBooks.length > 0) {
      var dots = '';
      var maxDots = Math.min(dayBooks.length, 3);
      for (var k = 0; k < maxDots; k++) {
        dots += '<span class="dot dot-' + dayBooks[k].status + '"></span>';
      }
      if (dayBooks.length > 3) {
        dots += '<span class="dot-extra">+' + (dayBooks.length - 3) + '</span>';
      }
      inner += '<div class="dot-row">' + dots + '</div>';
    }

    html += '<div class="' + cls + '" onclick="selectDay(\'' + dateStr + '\')">' + inner + '</div>';
  }

  grid.innerHTML = html;
}

// ── DAY SELECTION ─────────────────────────────────────────

function selectDay(dateStr) {
  selectedDate = dateStr;
  try { renderCalendar(); } catch (e) { console.error(e); }

  var parts   = dateStr.split('-');
  var heading = document.getElementById('detail-date-heading');
  if (heading) heading.textContent = parts[2] + '.' + parts[1] + '.' + parts[0];

  var isBlocked = allBlocked.indexOf(dateStr) !== -1;
  var btn = document.getElementById('block-btn');
  if (btn) {
    btn.style.display = '';
    btn.textContent   = isBlocked ? '🔓 Freigeben' : '🔒 Sperren';
    btn.className     = 'block-btn' + (isBlocked ? ' is-blocked' : '');
  }

  renderDayDetail(dateStr);

  // Mobile: slide up
  var detail   = document.getElementById('day-detail');
  var backdrop = document.getElementById('detail-backdrop');
  if (detail)   detail.classList.add('open');
  if (backdrop) backdrop.classList.remove('hidden');
}

function closeDetail() {
  var detail   = document.getElementById('day-detail');
  var backdrop = document.getElementById('detail-backdrop');
  if (detail)   detail.classList.remove('open');
  if (backdrop) backdrop.classList.add('hidden');
}

function renderDayDetail(dateStr) {
  var body = document.getElementById('day-detail-body');
  if (!body) return;

  var dayBks    = allBookings.filter(function (b) { return b.event_date === dateStr; });
  var isBlocked = allBlocked.indexOf(dateStr) !== -1;

  if (isBlocked && dayBks.length === 0) {
    body.innerHTML = '<div class="blocked-notice">🔒 Dieser Tag ist gesperrt.</div>';
    return;
  }
  if (dayBks.length === 0) {
    body.innerHTML = '<p class="detail-hint">Keine Buchungen für diesen Tag.</p>';
    return;
  }

  body.innerHTML = dayBks.map(function (b) {
    var timeStr = b.event_time ? b.event_time.slice(0, 5) : '–';
    if (b.event_time_end) timeStr += ' – ' + b.event_time_end.slice(0, 5);

    return '<div class="booking-card status-left-' + esc(b.status) + '">'
      + '<div class="booking-card-top">'
        + '<div>'
          + '<div class="booking-name">' + esc(b.name) + '</div>'
          + '<span class="status-badge status-' + esc(b.status) + '">' + statusLabel(b.status) + '</span>'
        + '</div>'
        + '<span class="booking-price">' + estimatePrice(b.guest_count) + '</span>'
      + '</div>'
      + '<div class="booking-info">'
        + '<div class="booking-info-item"><label>Uhrzeit</label><span>' + timeStr + '</span></div>'
        + '<div class="booking-info-item"><label>Personen</label><span>' + esc(b.guest_count) + '</span></div>'
        + '<div class="booking-info-item"><label>E-Mail</label><span><a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a></span></div>'
        + '<div class="booking-info-item"><label>Telefon</label><span><a href="tel:' + esc(b.phone) + '">' + esc(b.phone) + '</a></span></div>'
        + (b.event_location ? '<div class="booking-info-item span-2"><label>Veranstaltungsort</label><span>' + esc(b.event_location) + '</span></div>' : '')
      + '</div>'
      + (b.message ? '<div class="booking-msg">"' + esc(b.message) + '"</div>' : '')
      + '<div class="booking-actions">'
        + '<button class="action-btn btn-confirm" onclick="updateStatus(\'' + b.id + '\',\'confirmed\')"' + (b.status === 'confirmed' ? ' disabled' : '') + '>✓ Bestätigen</button>'
        + '<button class="action-btn btn-reject"  onclick="updateStatus(\'' + b.id + '\',\'cancelled\')"' + (b.status === 'cancelled' ? ' disabled' : '') + '>✕ Ablehnen</button>'
        + '<button class="action-btn btn-reset"   onclick="updateStatus(\'' + b.id + '\',\'pending\')"'   + (b.status === 'pending'   ? ' disabled' : '') + '>↺ Zurücksetzen</button>'
      + '</div>'
    + '</div>';
  }).join('');
}

// ── STATUS UPDATE ─────────────────────────────────────────

async function updateStatus(id, newStatus) {
  if (!_sb) { showError('Kein Supabase-Client.'); return; }
  showInfo('Status wird gespeichert…');
  try {
    var res = await _sb.from('bookings').update({ status: newStatus }).eq('id', id);
    if (res.error) { showError('Fehler: ' + res.error.message); return; }
    for (var i = 0; i < allBookings.length; i++) {
      if (allBookings[i].id === id) { allBookings[i].status = newStatus; break; }
    }
    showInfo('');
    updateStats();
    try { renderCalendar(); } catch (e) { console.error(e); }
    if (selectedDate) renderDayDetail(selectedDate);
    renderTable();
  } catch (e) {
    showError('Netzwerkfehler: ' + e.message);
  }
}

// ── BLOCK DATES ───────────────────────────────────────────

function toggleBlock() {
  if (!selectedDate) return;
  doToggleBlock(selectedDate);
}

async function doToggleBlock(dateStr) {
  if (!_sb) { showError('Kein Supabase-Client.'); return; }
  var isBlocked = allBlocked.indexOf(dateStr) !== -1;
  showInfo(isBlocked ? 'Tag wird freigegeben…' : 'Tag wird gesperrt…');
  try {
    if (isBlocked) {
      var r = await _sb.from('blocked_dates').delete().eq('date', dateStr);
      if (r.error) { showError('Fehler: ' + r.error.message); return; }
      allBlocked = allBlocked.filter(function (d) { return d !== dateStr; });
    } else {
      var r2 = await _sb.from('blocked_dates').insert([{ date: dateStr }]);
      if (r2.error) { showError('Fehler: ' + r2.error.message); return; }
      allBlocked.push(dateStr);
    }
    showInfo('');
    var nowBlocked = allBlocked.indexOf(dateStr) !== -1;
    var btn = document.getElementById('block-btn');
    if (btn) {
      btn.textContent = nowBlocked ? '🔓 Freigeben' : '🔒 Sperren';
      btn.className   = 'block-btn' + (nowBlocked ? ' is-blocked' : '');
    }
    try { renderCalendar(); } catch (e) { console.error(e); }
    if (selectedDate === dateStr) renderDayDetail(dateStr);
  } catch (e) {
    showError('Netzwerkfehler: ' + e.message);
  }
}

// ── BOOKING LIST TABLE ────────────────────────────────────

function filterTable(filter) {
  curFilter = filter;
  var btns = document.querySelectorAll('.filter-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].classList.toggle('active', btns[i].dataset.filter === filter);
  }
  renderTable();
}

function renderTable() {
  var rows    = curFilter === 'all'
    ? allBookings
    : allBookings.filter(function (b) { return b.status === curFilter; });
  var tbody   = document.getElementById('bookings-body');
  var table   = document.getElementById('bookings-table');
  var empty   = document.getElementById('admin-empty');
  var loading = document.getElementById('admin-loading');

  if (loading) loading.style.display = 'none';
  if (!tbody || !table || !empty) return;

  if (rows.length === 0) {
    table.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  table.style.display = '';
  empty.style.display = 'none';

  tbody.innerHTML = rows.map(function (b) {
    var timeStr = b.event_time ? b.event_time.slice(0, 5) : '–';
    if (b.event_time_end) timeStr += ' – ' + b.event_time_end.slice(0, 5);
    return '<tr>'
      + '<td class="td-date">'   + formatDate(b.event_date) + '</td>'
      + '<td class="td-name">'   + esc(b.name) + '</td>'
      + '<td><a href="mailto:' + esc(b.email) + '">' + esc(b.email) + '</a></td>'
      + '<td><a href="tel:'   + esc(b.phone) + '">' + esc(b.phone) + '</a></td>'
      + '<td>' + timeStr + '</td>'
      + '<td class="td-center">' + esc(b.guest_count) + '</td>'
      + '<td>' + (b.event_location ? esc(b.event_location) : '<span class="muted">–</span>') + '</td>'
      + '<td class="td-msg" title="' + (b.message ? esc(b.message) : '') + '">'
        + (b.message ? esc(b.message) : '<span class="muted">–</span>') + '</td>'
      + '<td><span class="status-badge status-' + esc(b.status) + '">' + statusLabel(b.status) + '</span></td>'
      + '<td class="td-date">' + formatDateTime(b.created_at) + '</td>'
    + '</tr>';
  }).join('');
}
