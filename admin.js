// admin.js – Edmund Panel

var _sb           = null;
var allBookings   = [];
var allBlocked    = [];
var allRecurring  = [];
var selectedDate  = null;
var curFilter     = 'all';

var _now     = new Date();
var curYear  = _now.getFullYear();
var curMonth = _now.getMonth();

// ── HELPERS ───────────────────────────────────────────────

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

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
  if (n <= 50)  return '~80–150 €';
  if (n <= 150) return '~150–300 €';
  return '300+ €';
}

// ── STATUS BANNER ─────────────────────────────────────────

function showInfo(msg) {
  var el = document.getElementById('admin-status');
  if (!el) return;
  el.textContent       = msg || '';
  el.style.display     = msg ? 'block' : 'none';
  el.style.background  = 'var(--surface)';
  el.style.color       = 'var(--text-muted)';
  el.style.borderLeft  = 'none';
}

function showError(msg) {
  var el = document.getElementById('admin-status');
  if (!el) { console.error('[admin]', msg); return; }
  el.textContent        = msg || '';
  el.style.display      = msg ? 'block' : 'none';
  el.style.background   = 'rgba(239,68,68,0.12)';
  el.style.color        = '#F87171';
  el.style.borderLeft   = '3px solid #EF4444';
  el.style.padding      = '10px 16px';
  el.style.borderRadius = '8px';
  console.error('[admin]', msg);
}

// ── LOGIN ─────────────────────────────────────────────────
// unlockDashboard() is called by the inline doLogin() in admin.html
// after password check – and also on session restore below.

function unlockDashboard() {
  if (typeof window.supabase === 'undefined') {
    var gErr = document.getElementById('gate-error');
    if (gErr) { gErr.textContent = 'Fehler: Supabase-CDN nicht geladen. Seite neu laden.'; gErr.style.display = 'block'; }
    return;
  }
  try {
    _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    var gErr2 = document.getElementById('gate-error');
    if (gErr2) { gErr2.textContent = 'Verbindungsfehler: ' + e.message; gErr2.style.display = 'block'; }
    return;
  }

  document.getElementById('admin-gate').style.display      = 'none';
  document.getElementById('admin-dashboard').style.display = 'block';
  sessionStorage.setItem('lorenz-admin', '1');

  try { renderCalendar(); } catch (e) { showError('Kalender-Fehler: ' + e.message); }
  loadAll();
}

function logout() {
  sessionStorage.removeItem('lorenz-admin');
  location.reload();
}

// Session-Wiederherstellung nach Seiten-Reload
if (sessionStorage.getItem('lorenz-admin') === '1') {
  unlockDashboard();
}

// ── DATA LOADING ──────────────────────────────────────────

async function loadAll() {
  if (!_sb) return;
  showInfo('Buchungen werden geladen…');

  try {
    var bRes = await _sb.from('bookings').select('*').order('event_date', { ascending: true });
    if (bRes.error) {
      showError('Fehler beim Laden der Buchungen: ' + bRes.error.message
        + ' → Bitte SQL-Fix-Skript in Supabase ausführen!');
    } else {
      allBookings = bRes.data || [];
    }
  } catch (e) {
    showError('Netzwerkfehler (Buchungen): ' + e.message);
  }

  try {
    var dRes = await _sb.from('blocked_dates').select('date');
    if (!dRes.error) {
      allBlocked = (dRes.data || []).map(function (r) { return r.date; });
    }
  } catch (e) {
    console.warn('[admin] blocked_dates:', e.message);
  }

  try {
    var rRes = await _sb.from('recurring_blocks').select('*').order('created_at', { ascending: false });
    if (!rRes.error) {
      allRecurring = rRes.data || [];
      renderRecurringList();
    }
  } catch (e) {
    console.warn('[admin] recurring_blocks:', e.message);
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
  if (!grid || !label) return;

  var MONTHS = ['Januar','Februar','März','April','Mai','Juni',
                'Juli','August','September','Oktober','November','Dezember'];
  label.textContent = MONTHS[curMonth] + ' ' + curYear;

  var bookingMap = {};
  for (var i = 0; i < allBookings.length; i++) {
    var b = allBookings[i];
    if (!b.event_date) continue;
    if (!bookingMap[b.event_date]) bookingMap[b.event_date] = [];
    bookingMap[b.event_date].push(b);
  }

  var firstDay    = new Date(curYear, curMonth, 1);
  var startOffset = (firstDay.getDay() + 6) % 7;
  var daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  var today       = new Date();
  var todayStr    = today.getFullYear() + '-' + pad2(today.getMonth() + 1) + '-' + pad2(today.getDate());

  var html = '';
  for (var e = 0; e < startOffset; e++) {
    html += '<div class="cal-cell empty"></div>';
  }

  for (var d = 1; d <= daysInMonth; d++) {
    var dateStr  = curYear + '-' + pad2(curMonth + 1) + '-' + pad2(d);
    var dayBooks = bookingMap[dateStr] || [];
    var isBlocked  = allBlocked.indexOf(dateStr) !== -1;
    var isToday    = dateStr === todayStr;
    var weekdayJs  = new Date(curYear, curMonth, d).getDay();
    var weekdayMo  = (weekdayJs + 6) % 7;
    var isWeekend  = weekdayJs === 0 || weekdayJs === 6;
    var isSelected = dateStr === selectedDate;

    var isRecFull = false, isRecPart = false;
    for (var ri = 0; ri < allRecurring.length; ri++) {
      var rec = allRecurring[ri];
      if (rec.type === 'weekday' && rec.weekday === weekdayMo) { isRecFull = true; break; }
      if (rec.type === 'weekday_time' && rec.weekday === weekdayMo) isRecPart = true;
      if (rec.type === 'date_time' && rec.specific_date === dateStr) isRecPart = true;
    }

    var cls = 'cal-cell';
    if (isToday)    cls += ' today';
    if (isWeekend)  cls += ' weekend';
    if (isBlocked)  cls += ' blocked';
    else if (isRecFull) cls += ' rec-blocked';
    else if (isRecPart) cls += ' rec-partial';
    if (isSelected) cls += ' selected';

    var inner = '<span class="day-num">' + d + '</span>';

    if (isBlocked) {
      inner += '<span class="blocked-x">✕</span>';
    } else if (isRecFull) {
      inner += '<span class="blocked-x">🔁</span>';
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
        + (b.event_location ? '<div class="booking-info-item bii-full"><label>Ort</label><span>' + esc(b.event_location) + '</span></div>' : '')
      + '</div>'
      + (b.message ? '<div class="booking-msg">"' + esc(b.message) + '"</div>' : '')
      + '<div class="booking-actions">'
        + '<button class="action-btn btn-confirm" onclick="updateStatus(\'' + b.id + '\',\'confirmed\')"' + (b.status === 'confirmed' ? ' disabled' : '') + '>✓ Bestätigen</button>'
        + '<button class="action-btn btn-reject"  onclick="updateStatus(\'' + b.id + '\',\'cancelled\')"' + (b.status === 'cancelled' ? ' disabled' : '') + '>✕ Ablehnen</button>'
        + '<button class="action-btn btn-reset"   onclick="updateStatus(\'' + b.id + '\',\'pending\')"'   + (b.status === 'pending'   ? ' disabled' : '') + '>↺ Zurücksetzen</button>'
      + '</div>'
      + '<div class="booking-notes">'
        + '<label class="notes-label">Notizen (nur für dich sichtbar)</label>'
        + '<textarea class="notes-input" id="notes-' + b.id + '" placeholder="z.B. Musikwünsche, Anfahrt, Besonderheiten…">' + esc(b.admin_notes || '') + '</textarea>'
        + '<button class="action-btn btn-save-notes" onclick="saveNotes(\'' + b.id + '\')">💾 Notiz speichern</button>'
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
    if (res.error) {
      showError('UPDATE Fehler: ' + res.error.message + ' | Code: ' + res.error.code);
      return;
    }

    // Sofort aus DB zurücklesen um zu prüfen ob wirklich gespeichert
    var verify = await _sb.from('bookings').select('status').eq('id', id).single();
    if (verify.error) {
      showError('Lese-Fehler nach Update: ' + verify.error.message);
      return;
    }
    if (verify.data.status !== newStatus) {
      showError('Nicht gespeichert! DB zeigt noch: ' + verify.data.status + ' → RLS oder GRANT prüfen');
      return;
    }

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
      if (r.error) {
        showError('DELETE Fehler: ' + r.error.message + ' | Code: ' + r.error.code + ' | Details: ' + r.error.details);
        return;
      }
      allBlocked = allBlocked.filter(function (d) { return d !== dateStr; });
    } else {
      var r2 = await _sb.from('blocked_dates').insert([{ date: dateStr }]);
      if (r2.error) {
        showError('INSERT Fehler: ' + r2.error.message + ' | Code: ' + r2.error.code + ' | Details: ' + r2.error.details);
        return;
      }
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

async function blockRange() {
  var from = document.getElementById('range-from')?.value;
  var to   = document.getElementById('range-to')?.value;
  if (!from || !to) { showError('Bitte Von- und Bis-Datum auswählen.'); return; }
  if (from > to)    { showError('Von-Datum muss vor Bis-Datum liegen.'); return; }

  showInfo('Zeitraum wird gesperrt…');
  var dates = [];
  var cur = new Date(from + 'T00:00:00');
  var end = new Date(to   + 'T00:00:00');
  while (cur <= end) {
    var ds = cur.getFullYear() + '-' + pad2(cur.getMonth()+1) + '-' + pad2(cur.getDate());
    if (allBlocked.indexOf(ds) === -1) dates.push({ date: ds });
    cur.setDate(cur.getDate() + 1);
  }

  if (dates.length === 0) { showInfo('Alle Tage bereits gesperrt.'); return; }

  var r = await _sb.from('blocked_dates').insert(dates);
  if (r.error) { showError('Fehler: ' + r.error.message); return; }

  dates.forEach(function(d) { allBlocked.push(d.date); });
  showInfo(dates.length + ' Tage gesperrt.');
  document.getElementById('range-from').value = '';
  document.getElementById('range-to').value   = '';
  try { renderCalendar(); } catch(e) {}
  setTimeout(function() { showInfo(''); }, 2000);
}

async function saveNotes(id) {
  if (!_sb) return;
  var ta = document.getElementById('notes-' + id);
  if (!ta) return;
  var notes = ta.value;

  var res = await _sb.from('bookings').update({ admin_notes: notes }).eq('id', id);
  if (res.error) { showError('Fehler beim Speichern: ' + res.error.message); return; }

  for (var i = 0; i < allBookings.length; i++) {
    if (allBookings[i].id === id) { allBookings[i].admin_notes = notes; break; }
  }

  var btn = document.querySelector('#notes-' + id + ' ~ .btn-save-notes');
  if (!btn) { btn = ta.parentElement.querySelector('.btn-save-notes'); }
  if (btn) {
    var orig = btn.textContent;
    btn.textContent = '✓ Gespeichert!';
    setTimeout(function() { btn.textContent = orig; }, 1800);
  }
}

// ── RECURRING BLOCKS ─────────────────────────────────────

var DAYS_DE = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag'];

function recLabel(r) {
  var t = (r.time_from || '').slice(0,5) + '–' + (r.time_to || '').slice(0,5);
  var base = '';
  if (r.type === 'weekday')      base = 'Jeden ' + DAYS_DE[r.weekday] + ' – ganztags';
  if (r.type === 'weekday_time') base = 'Jeden ' + DAYS_DE[r.weekday] + ' ' + t + ' Uhr';
  if (r.type === 'date_time')    base = formatDate(r.specific_date) + ' – ' + t + ' Uhr';
  return r.label ? base + ' (' + esc(r.label) + ')' : base;
}

function renderRecurringList() {
  var el = document.getElementById('recurring-list');
  if (!el) return;
  if (allRecurring.length === 0) {
    el.innerHTML = '<div class="recurring-empty">Noch keine Regeln angelegt.</div>';
    return;
  }
  el.innerHTML = allRecurring.map(function(r) {
    var typeIcon = r.type === 'weekday' ? '🔒' : '⏰';
    return '<div class="recurring-item">'
      + '<span class="recurring-item-icon">' + typeIcon + '</span>'
      + '<span class="recurring-item-label">' + recLabel(r) + '</span>'
      + '<button class="rec-delete-btn" onclick="deleteRecurring(\'' + r.id + '\')">✕</button>'
    + '</div>';
  }).join('');
}

function onRecTypeChange() {
  var type = document.getElementById('rec-type').value;
  var wdWrap = document.getElementById('rec-weekday-wrap');
  var dtWrap = document.getElementById('rec-date-wrap');
  var tWrap  = document.getElementById('rec-time-wrap');
  if (wdWrap) wdWrap.style.display = (type === 'date_time') ? 'none' : 'flex';
  if (dtWrap) dtWrap.style.display = (type === 'date_time') ? 'flex' : 'none';
  if (tWrap)  tWrap.style.display  = (type === 'weekday')   ? 'none' : 'flex';
}

async function addRecurring() {
  if (!_sb) return;
  var type    = document.getElementById('rec-type').value;
  var weekday = parseInt(document.getElementById('rec-weekday').value, 10);
  var date    = document.getElementById('rec-date') ? document.getElementById('rec-date').value : '';
  var from    = document.getElementById('rec-time-from') ? document.getElementById('rec-time-from').value : '';
  var to      = document.getElementById('rec-time-to')   ? document.getElementById('rec-time-to').value   : '';
  var label   = document.getElementById('rec-label')     ? document.getElementById('rec-label').value.trim() : '';

  if (type !== 'date_time' && isNaN(weekday)) { showError('Wochentag fehlt.'); return; }
  if (type === 'date_time' && !date)           { showError('Datum fehlt.'); return; }
  if (type !== 'weekday'  && (!from || !to))   { showError('Von- und Bis-Uhrzeit fehlen.'); return; }

  var payload = { type: type, label: label || null };
  if (type !== 'date_time') payload.weekday = weekday;
  if (type === 'date_time') payload.specific_date = date;
  if (type !== 'weekday')   { payload.time_from = from; payload.time_to = to; }

  var r = await _sb.from('recurring_blocks').insert([payload]);
  if (r.error) { showError('Fehler: ' + r.error.message); return; }

  showInfo('Regel gespeichert.');
  if (document.getElementById('rec-label'))     document.getElementById('rec-label').value = '';
  if (document.getElementById('rec-date'))      document.getElementById('rec-date').value  = '';
  if (document.getElementById('rec-time-from')) document.getElementById('rec-time-from').value = '';
  if (document.getElementById('rec-time-to'))   document.getElementById('rec-time-to').value   = '';

  var rRes = await _sb.from('recurring_blocks').select('*').order('created_at', { ascending: false });
  if (!rRes.error) allRecurring = rRes.data || [];
  renderRecurringList();
  try { renderCalendar(); } catch(e) {}
  setTimeout(function() { showInfo(''); }, 2000);
}

async function deleteRecurring(id) {
  if (!_sb) return;
  var r = await _sb.from('recurring_blocks').delete().eq('id', id);
  if (r.error) { showError('Fehler beim Löschen: ' + r.error.message); return; }
  allRecurring = allRecurring.filter(function(x) { return x.id !== id; });
  renderRecurringList();
  try { renderCalendar(); } catch(e) {}
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
