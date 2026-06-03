-- ================================================
--  DJ Lorenz – Buchungssystem Supabase Setup
--  Ausführen: Supabase Dashboard → SQL Editor → Run
-- ================================================

CREATE TABLE IF NOT EXISTS bookings (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT        NOT NULL,
  email       TEXT        NOT NULL,
  phone       TEXT        NOT NULL,
  event_date  DATE        NOT NULL,
  event_time  TIME        NOT NULL,
  guest_count INTEGER     NOT NULL CHECK (guest_count > 0),
  message     TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security aktivieren
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Buchungen einreichen (öffentliches Formular)
CREATE POLICY "allow_public_insert" ON bookings
  FOR INSERT TO anon WITH CHECK (true);

-- Buchungen lesen (für Admin-Ansicht)
-- HINWEIS: Für echte Sicherheit → Supabase Auth einsetzen!
CREATE POLICY "allow_public_select" ON bookings
  FOR SELECT TO anon USING (true);
