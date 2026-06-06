// booking.js – Navbar-Scroll + Buchungsformular mit Supabase

// Scroll-Reveal
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('revealed');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('[data-reveal]').forEach(el => revealObserver.observe(el));

// Ripple-Effekt auf allen Buttons
document.querySelectorAll('.btn').forEach(btn => {
  btn.style.position = 'relative';
  btn.style.overflow = 'hidden';
  btn.addEventListener('click', (e) => {
    const r = document.createElement('span');
    r.className = 'ripple';
    const rect = btn.getBoundingClientRect();
    r.style.left = (e.clientX - rect.left - 6) + 'px';
    r.style.top  = (e.clientY - rect.top  - 6) + 'px';
    btn.appendChild(r);
    setTimeout(() => r.remove(), 700);
  });
});

// Stats-Counter im Hero-Card
function animateCounter(el, target, suffix, duration) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;
  let start = null;
  function step(ts) {
    if (!start) start = ts;
    const p = Math.min((ts - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.floor(eased * target) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
window.addEventListener('load', () => {
  setTimeout(() => {
    document.querySelectorAll('[data-counter]').forEach(el => {
      animateCounter(el, parseInt(el.dataset.counter), el.dataset.suffix || '', 1400);
    });
  }, 1300);
});

// Navbar: Hintergrund beim Scrollen einblenden
window.addEventListener('scroll', () => {
  document.getElementById('navbar')
    .classList.toggle('scrolled', window.scrollY > 50);
});

// Hamburger-Menü
const hamburger = document.getElementById('nav-hamburger');
const navLinks  = document.getElementById('nav-links');

hamburger.addEventListener('click', () => {
  const isOpen = hamburger.classList.toggle('open');
  navLinks.classList.toggle('open', isOpen);
  hamburger.setAttribute('aria-expanded', isOpen);
});

navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  });
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.navbar')) {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }
});

// ── VERFÜGBARKEIT ─────────────────────────────────────────────
// Gebuchte und gesperrte Tage vorladen, damit Kunden sofort
// sehen welche Daten bereits vergeben sind.

let _takenDates     = [];
let _recurringRules = [];

var _availYear  = new Date().getFullYear();
var _availMonth = new Date().getMonth();

function availPad2(n) { return n < 10 ? '0' + n : '' + n; }

function checkRecurring(dateStr) {
  var weekday = (new Date(dateStr + 'T00:00:00').getDay() + 6) % 7;
  var fullBlocked = false;
  var partials    = [];
  for (var i = 0; i < _recurringRules.length; i++) {
    var r = _recurringRules[i];
    if (r.type === 'weekday' && r.weekday === weekday) { fullBlocked = true; break; }
    if (r.type === 'weekday_time' && r.weekday === weekday) {
      partials.push((r.time_from || '').slice(0,5) + '–' + (r.time_to || '').slice(0,5) + (r.label ? ' (' + r.label + ')' : ''));
    }
    if (r.type === 'date_time' && r.specific_date === dateStr) {
      partials.push((r.time_from || '').slice(0,5) + '–' + (r.time_to || '').slice(0,5) + (r.label ? ' (' + r.label + ')' : ''));
    }
  }
  return { fullBlocked: fullBlocked, partials: partials };
}

function renderAvailCalendar() {
  var grid  = document.getElementById('avail-cal-grid');
  var label = document.getElementById('avail-month-label');
  if (!grid || !label) return;

  var MONTHS = ['Januar','Februar','März','April','Mai','Juni',
                'Juli','August','September','Oktober','November','Dezember'];
  label.textContent = MONTHS[_availMonth] + ' ' + _availYear;

  var firstDay    = new Date(_availYear, _availMonth, 1);
  var startOffset = (firstDay.getDay() + 6) % 7;
  var daysInMonth = new Date(_availYear, _availMonth + 1, 0).getDate();
  var today       = new Date(); today.setHours(0,0,0,0);
  var currentVal  = document.getElementById('event_date')?.value || '';

  var html = '';
  for (var e = 0; e < startOffset; e++) html += '<div class="avail-cell empty"></div>';

  for (var d = 1; d <= daysInMonth; d++) {
    var ds   = _availYear + '-' + availPad2(_availMonth + 1) + '-' + availPad2(d);
    var date = new Date(_availYear, _availMonth, d);
    var isPast     = date < today;
    var isTaken    = _takenDates.indexOf(ds) !== -1;
    var isSelected = currentVal === ds;
    var weekday    = date.getDay();
    var isWeekend  = weekday === 0 || weekday === 6;

    var rec         = checkRecurring(ds);
    var isRecFull   = rec.fullBlocked;
    var isRecPart   = rec.partials.length > 0;
    var isFullBlock = isTaken || isRecFull;

    var cls = 'avail-cell';
    if (isPast)          cls += ' past';
    else if (isFullBlock) cls += ' taken';
    else if (isRecPart)   cls += ' partial';
    else                  cls += ' free';
    if (isSelected)    cls += ' sel';
    if (isWeekend && !isPast && !isFullBlock) cls += ' weekend';

    var click = (!isPast && !isFullBlock)
      ? ' onclick="selectAvailDate(\'' + ds + '\')"' : '';

    html += '<div class="' + cls + '"' + click + '>' + d + '</div>';
  }
  grid.innerHTML = html;
}

function selectAvailDate(ds) {
  var rec = checkRecurring(ds);
  var inp = document.getElementById('event_date');
  var lbl = document.getElementById('avail-selected');
  if (inp) inp.value = ds;
  if (lbl) {
    var p = ds.split('-');
    lbl.textContent = '✓ ' + p[2] + '.' + p[1] + '.' + p[0] + ' ausgewählt';
    lbl.className = 'avail-selected-label active';
  }
  renderAvailCalendar();
  var mb = document.getElementById('form-message');
  if (mb) {
    if (rec.partials.length > 0) {
      mb.textContent = '⚠️ Hinweis: An diesem Tag ist Lorenz von ' + rec.partials.join(' und ') + ' Uhr nicht verfügbar. Bitte wähle eine Uhrzeit außerhalb dieser Zeiten.';
      mb.className = 'form-message warning';
    } else if (mb.classList.contains('error') || mb.classList.contains('warning')) {
      mb.textContent = '';
      mb.className = 'form-message';
    }
  }
}

function availPrevMonth() {
  _availMonth--;
  if (_availMonth < 0) { _availMonth = 11; _availYear--; }
  renderAvailCalendar();
}

function availNextMonth() {
  _availMonth++;
  if (_availMonth > 11) { _availMonth = 0; _availYear++; }
  renderAvailCalendar();
}

async function loadAvailability() {
  if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL === 'DEINE_SUPABASE_URL') return;
  try {
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const [blockedRes, bookedRes, recurringRes] = await Promise.all([
      sb.from('blocked_dates').select('date'),
      sb.from('bookings').select('event_date').eq('status', 'confirmed'),
      sb.from('recurring_blocks').select('*'),
    ]);
    const blockedList = (blockedRes.data || []).map(r => r.date);
    const bookedList  = (bookedRes.data  || []).map(r => r.event_date);
    _takenDates     = [...new Set([...blockedList, ...bookedList])];
    _recurringRules = recurringRes.data || [];
    renderAvailCalendar();

    const dateInput = document.getElementById('event_date');
    if (dateInput) dateInput.addEventListener('change', checkDateAvailability);
  } catch (e) {
    // Nicht kritisch – Formular funktioniert auch ohne Verfügbarkeitscheck
  }
}

function checkDateAvailability() {
  const val    = document.getElementById('event_date')?.value;
  const msgBox = document.getElementById('form-message');
  if (!val || !msgBox) return;

  if (_takenDates.includes(val)) {
    msgBox.textContent = '⚠️ Dieser Tag ist leider bereits belegt oder gesperrt. Bitte wähle ein anderes Datum.';
    msgBox.className   = 'form-message error';
  } else if (msgBox.classList.contains('error') && msgBox.textContent.includes('belegt')) {
    msgBox.textContent = '';
    msgBox.className   = 'form-message';
  }
}

// ── BUCHUNGSFORMULAR ──────────────────────────────────────────

const form      = document.getElementById('booking-form');
const submitBtn = document.getElementById('submit-btn');
const msgBox    = document.getElementById('form-message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (SUPABASE_URL === 'DEINE_SUPABASE_URL' || SUPABASE_ANON_KEY === 'DEIN_ANON_KEY') {
    showMessage('Bitte trage zuerst deine Supabase-Zugangsdaten in config.js ein.', 'error');
    return;
  }

  // Belegten Tag vor dem Absenden nochmals prüfen
  const chosenDate = form.event_date.value;
  if (chosenDate && _takenDates.includes(chosenDate)) {
    showMessage('⚠️ Dieser Tag ist bereits belegt oder gesperrt. Bitte wähle ein anderes Datum.', 'error');
    return;
  }

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Wird gesendet …';
  msgBox.className      = 'form-message';
  msgBox.textContent    = '';

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const payload = {
    name:           form.name.value.trim(),
    email:          form.email.value.trim(),
    phone:          form.phone.value.trim(),
    event_date:     form.event_date.value,
    event_time:     form.event_time.value,
    event_time_end: form.event_time_end.value || null,
    guest_count:    parseInt(form.guest_count.value, 10),
    event_location: form.event_location ? (form.event_location.value.trim() || null) : null,
    message:        form.message.value.trim() || null,
  };

  let { error } = await supabase.from('bookings').insert([payload]);

  // Fallback: PostgREST Schema-Cache kennt optionale Spalten noch nicht
  if (error && error.message && (
    error.message.includes('event_location') ||
    error.message.includes('event_time_end')
  )) {
    const fallback = { ...payload };
    delete fallback.event_location;
    delete fallback.event_time_end;
    const retry = await supabase.from('bookings').insert([fallback]);
    error = retry.error;
  }

  if (error) {
    showMessage(`Fehler beim Senden: ${error.message}`, 'error');
    console.error(error);
  } else {
    showMessage('Anfrage erfolgreich! Ich melde mich innerhalb von 24 Stunden bei dir.', 'success');
    form.reset();
    if (chosenDate) _takenDates.push(chosenDate);
  }

  submitBtn.disabled    = false;
  submitBtn.textContent = 'Anfrage absenden';
});

function showMessage(text, type) {
  msgBox.textContent = text;
  msgBox.className   = `form-message ${type}`;
}

// Verfügbarkeit laden sobald DOM bereit ist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { renderAvailCalendar(); loadAvailability(); });
} else {
  loadAvailability();
  renderAvailCalendar();
}
