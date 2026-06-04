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
  event_time     TIME        NOT NULL,
  event_time_end TIME,
  guest_count INTEGER     NOT NULL CHECK (guest_count > 0),
  event_location TEXT,
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
CREATE POLICY "allow_public_select" ON bookings
  FOR SELECT TO anon USING (true);

-- Buchungsstatus ändern (für Admin)
CREATE POLICY "allow_public_update" ON bookings
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Spalten nachträglich hinzufügen (sicher, falls Tabelle bereits existiert)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_time_end TIME;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_location TEXT;

-- ── GESPERRTE TAGE ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS blocked_dates (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  date       DATE        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_public_select_blocked" ON blocked_dates
  FOR SELECT TO anon USING (true);

CREATE POLICY "allow_public_insert_blocked" ON blocked_dates
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "allow_public_delete_blocked" ON blocked_dates
  FOR DELETE TO anon USING (true);
