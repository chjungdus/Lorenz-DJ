// admin.js – Buchungsübersicht (nur lesen)

// Supabase wird erst nach Login initialisiert
let supabase;

let allBookings   = [];
let currentFilter = 'all';

// ── PASSWORT-GATE ─────────────────────────────────────────

function checkPassword() {
  const input = document.getElementById('gate-password').value;
  if (input === ADMIN_PASSWORD) {
    unlockDashboard();
  } else {
    document.getElementById('gate-error').textContent = 'Falsches Passwort.';
    document.getElementById('gate-password').focus();
  }
}

function unlockDashboard() {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  document.getElementById('admin-gate').style.display      = 'none';
  document.getElementById('admin-dashboard').style.display = 'block';
  sessionStorage.setItem('lorenz-admin', '1');
  loadBookings();
}

function logout() {
  sessionStorage.removeItem('lorenz-admin');
  location.reload();
}

// Enter-Taste im Passwortfeld
document.getElementById('gate-password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') checkPassword();
});

// Session noch aktiv?
if (sessionStorage.getItem('lorenz-admin') === '1') unlockDashboard();

// ── DATEN LADEN ───────────────────────────────────────────

async function loadBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('event_date', { ascending: true });

  document.getElementById('admin-loading').style.display = 'none';

  if (error) {
    const el = document.getElementById('admin-loading');
    el.textContent = 'Fehler beim Laden der Buchungen. Bitte Supabase-Konfiguration prüfen.';
    el.style.display = 'block';
    console.error(error);
    return;
  }

  allBookings = data || [];
  updateStats();
  renderTable(currentFilter);
}

// ── STATISTIKEN ───────────────────────────────────────────

function updateStats() {
  document.getElementById('stat-total').textContent     = allBookings.length;
  document.getElementById('stat-pending').textContent   = allBookings.filter(b => b.status === 'pending').length;
  document.getElementById('stat-confirmed').textContent = allBookings.filter(b => b.status === 'confirmed').length;
  document.getElementById('stat-cancelled').textContent = allBookings.filter(b => b.status === 'cancelled').length;
}

// ── TABELLE RENDERN ───────────────────────────────────────

function renderTable(filter) {
  const rows  = filter === 'all' ? allBookings : allBookings.filter(b => b.status === filter);
  const tbody = document.getElementById('bookings-body');
  const table = document.getElementById('bookings-table');
  const empty = document.getElementById('admin-empty');

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
      <td>${b.event_time ? b.event_time.slice(0, 5) : '–'}</td>
      <td class="td-center">${b.guest_count}</td>
      <td class="td-msg" title="${b.message ? esc(b.message) : ''}">${b.message ? esc(b.message) : '<span class="muted">–</span>'}</td>
      <td><span class="status-badge status-${esc(b.status)}">${statusLabel(b.status)}</span></td>
      <td class="td-date">${formatDateTime(b.created_at)}</td>
    </tr>
  `).join('');
}

// ── FILTER-BUTTONS ────────────────────────────────────────

document.getElementById('filter-bar').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.filter;
  renderTable(currentFilter);
});

// ── HILFSFUNKTIONEN ───────────────────────────────────────

function formatDate(str) {
  if (!str) return '–';
  const [y, m, d] = str.split('-');
  return `${d}.${m}.${y}`;
}

function formatDateTime(str) {
  if (!str) return '–';
  return new Date(str).toLocaleDateString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
}

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
