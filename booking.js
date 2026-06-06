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

let _takenDates = [];

async function loadAvailability() {
  if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL === 'DEINE_SUPABASE_URL') return;
  try {
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const [blockedRes, bookedRes] = await Promise.all([
      sb.from('blocked_dates').select('date'),
      sb.from('bookings').select('event_date').eq('status', 'confirmed'),
    ]);
    const blockedList = (blockedRes.data || []).map(r => r.date);
    const bookedList  = (bookedRes.data  || []).map(r => r.event_date);
    _takenDates = [...new Set([...blockedList, ...bookedList])];

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
  document.addEventListener('DOMContentLoaded', loadAvailability);
} else {
  loadAvailability();
}
