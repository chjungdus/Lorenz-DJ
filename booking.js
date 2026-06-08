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

// Buchungsformular
const form      = document.getElementById('booking-form');
const submitBtn = document.getElementById('submit-btn');
const msgBox    = document.getElementById('form-message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (SUPABASE_URL === 'DEINE_SUPABASE_URL' || SUPABASE_ANON_KEY === 'DEIN_ANON_KEY') {
    showMessage('Bitte trage zuerst deine Supabase-Zugangsdaten in config.js ein.', 'error');
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

  const { error } = await supabase.from('bookings').insert([payload]);

  if (error) {
    showMessage(`Fehler beim Senden: ${error.message}`, 'error');
    console.error(error);
  } else {
    showMessage('Anfrage erfolgreich! Ich melde mich innerhalb von 24 Stunden bei dir.', 'success');
    form.reset();
  }

  submitBtn.disabled    = false;
  submitBtn.textContent = 'Anfrage absenden';
});

function showMessage(text, type) {
  msgBox.textContent = text;
  msgBox.className   = `form-message ${type}`;
}
