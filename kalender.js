// kalender.js – Buchungskalender für Lorenz

let supabase;
let allBookings = [];
let currentYear, currentMonth;

// ── PASSWORT-GATE ────────────────────────────────────────

function checkPassword() {
  const input = document.getElementById('gate-password').value;
  if (input === ADMIN_PASSWORD) {
    unlockCalendar();
  } else {
    document.getElementById('gate-error').textContent = 'Falsches Passwort.';
    document.getElementById('gate-password').focus();
  }
}

function unlockCalendar() {
  try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) {
    document.getElementById('gate-error').textContent = 'Verbindungsfehler. Bitte Seite neu laden.';
    console.error('Supabase init failed:', e);
    return;
  }
  document.getElementById('cal-gate').style.display = 'none';
  document.getElementById('cal-app').style.display  = 'block';
  sessionStorage.setItem('lorenz-cal', '1');

  const now = new Date();
  currentYear  = now.getFullYear();
  currentMonth = now.getMonth(); // 0-based
  loadBookings();
}

function logout() {
  sessionStorage.removeItem('lorenz-cal');
  location.reload();
}

document.getElementById('cal-gate-form').addEventListener('submit', (e) => {
  e.preventDefault();
  checkPassword();
});

const calLogoutBtn = document.getElementById('cal-logout-btn');
if (calLogoutBtn) calLogoutBtn.addEventListener('click', logout);

if (sessionStorage.getItem('lorenz-cal') === '1') unlockCalendar();

// ── DATEN LADEN ──────────────────────────────────────────

async function loadBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, name, event_date, event_time, event_time_end, guest_count, status, message')
    .order('event_date', { ascending: true });

  if (error) { console.error(error); return; }

  allBookings = data || [];
  renderCalendar();
}

// ── KALENDER RENDERN ─────────────────────────────────────

function renderCalendar() {
  const grid  = document.getElementById('cal-grid');
  const label = document.getElementById('month-label');

  const monthNames = ['Januar','Februar','März','April','Mai','Juni',
                      'Juli','August','September','Oktober','November','Dezember'];
  label.textContent = `${monthNames[currentMonth]} ${currentYear}`;

  // Erster Tag des Monats (Montag-basiert, 0=Mo…6=So)
  const firstDay = new Date(currentYear, currentMonth, 1);
  let startOffset = firstDay.getDay() - 1; // JS: 0=So → umrechnen
  if (startOffset < 0) startOffset = 6;

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const today = new Date();

  // Buchungen dieses Monats als Map: 'YYYY-MM-DD' → [booking, ...]
  const bookingMap = {};
  allBookings.forEach(b => {
    if (!bookingMap[b.event_date]) bookingMap[b.event_date] = [];
    bookingMap[b.event_date].push(b);
  });

  grid.innerHTML = '';

  // Leer-Zellen vor dem 1.
  for (let i = 0; i < startOffset; i++) {
    grid.insertAdjacentHTML('beforeend', '<div class="cal-cell empty"></div>');
  }

  // Tage
  for (let d = 1; d <= daysInMonth; d++) {
    const mm   = String(currentMonth + 1).padStart(2, '0');
    const dd   = String(d).padStart(2, '0');
    const dateStr = `${currentYear}-${mm}-${dd}`;
    const dayBookings = bookingMap[dateStr] || [];

    const isToday = (
      today.getFullYear() === currentYear &&
      today.getMonth()    === currentMonth &&
      today.getDate()     === d
    );

    const weekday = new Date(currentYear, currentMonth, d).getDay();
    const isWeekend = weekday === 0 || weekday === 6;

    const dotsHtml = dayBookings.slice(0, 3).map(b =>
      `<span class="dot dot-${b.status}"></span>`
    ).join('');
    const extraCount = dayBookings.length > 3 ? `<span class="dot-extra">+${dayBookings.length - 3}</span>` : '';

    const cell = document.createElement('div');
    cell.className = 'cal-cell' +
      (isToday   ? ' today'   : '') +
      (isWeekend ? ' weekend' : '') +
      (dayBookings.length > 0 ? ' has-bookings' : '');
    cell.innerHTML = `<span class="day-num">${d}</span><div class="dot-row">${dotsHtml}${extraCount}</div>`;

    if (dayBookings.length > 0) {
      cell.addEventListener('click', () => showDetail(dateStr, dayBookings));
    }

    grid.appendChild(cell);
  }
}

// ── MONATSNAVIGATION ─────────────────────────────────────

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

// ── DETAIL-PANEL ─────────────────────────────────────────

function showDetail(dateStr, bookings) {
  const panel    = document.getElementById('detail-panel');
  const backdrop = document.getElementById('detail-backdrop');
  const dateEl   = document.getElementById('detail-date');
  const listEl   = document.getElementById('detail-list');

  const [y, m, d] = dateStr.split('-');
  dateEl.textContent = `${d}.${m}.${y}`;

  listEl.innerHTML = bookings.map(b => `
    <div class="detail-card status-border-${b.status}">
      <div class="detail-top">
        <strong>${esc(b.name)}</strong>
        <span class="status-badge status-${b.status}">${statusLabel(b.status)}</span>
      </div>
      <div class="detail-meta">
        ${b.event_time ? `<span>Uhrzeit: ${b.event_time.slice(0,5)}${b.event_time_end ? ' – ' + b.event_time_end.slice(0,5) : ''}</span>` : ''}
        <span>Personen: ${b.guest_count}</span>
      </div>
      ${b.message ? `<p class="detail-msg">${esc(b.message)}</p>` : ''}
    </div>
  `).join('');

  panel.classList.remove('hidden');
  backdrop.classList.remove('hidden');
}

function closeDetail() {
  document.getElementById('detail-panel').classList.add('hidden');
  document.getElementById('detail-backdrop').classList.add('hidden');
}

document.getElementById('detail-close').addEventListener('click', closeDetail);
document.getElementById('detail-backdrop').addEventListener('click', closeDetail);

// ── HILFSFUNKTIONEN ──────────────────────────────────────

function statusLabel(s) {
  return { pending: 'Ausstehend', confirmed: 'Bestätigt', cancelled: 'Abgelehnt' }[s] ?? s;
}

function esc(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}
