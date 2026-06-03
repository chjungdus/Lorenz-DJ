// booking.js – Navbar-Scroll + Buchungsformular mit Supabase

// Supabase-Client initialisieren
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

// Menü schließen wenn ein Link geklickt wird
navLinks.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  });
});

// Menü schließen beim Klick außerhalb
document.addEventListener('click', (e) => {
  if (!e.target.closest('.navbar')) {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
  }
});

// Buchungsformular
const form       = document.getElementById('booking-form');
const submitBtn  = document.getElementById('submit-btn');
const msgBox     = document.getElementById('form-message');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Konfiguration prüfen
  if (SUPABASE_URL === 'DEINE_SUPABASE_URL' || SUPABASE_ANON_KEY === 'DEIN_ANON_KEY') {
    showMessage('Bitte trage zuerst deine Supabase-Zugangsdaten in config.js ein.', 'error');
    return;
  }

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Wird gesendet …';
  msgBox.className      = 'form-message';
  msgBox.textContent    = '';

  const payload = {
    name:        form.name.value.trim(),
    email:       form.email.value.trim(),
    phone:       form.phone.value.trim(),
    event_date:  form.event_date.value,
    event_time:  form.event_time.value,
    guest_count: parseInt(form.guest_count.value, 10),
    message:     form.message.value.trim() || null,
  };

  const { error } = await supabase.from('bookings').insert([payload]);

  if (error) {
    showMessage('Etwas ist schiefgelaufen. Bitte versuch es nochmal oder meld dich direkt.', 'error');
    console.error(error);
  } else {
    showMessage('🎉 Anfrage erfolgreich! Ich melde mich innerhalb von 24 Stunden bei dir.', 'success');
    form.reset();
  }

  submitBtn.disabled    = false;
  submitBtn.textContent = 'Anfrage absenden';
});

function showMessage(text, type) {
  msgBox.textContent = text;
  msgBox.className   = `form-message ${type}`;
}
