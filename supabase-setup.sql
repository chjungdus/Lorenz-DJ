-- ================================================
--  DJ Adler – Supabase FIX-SKRIPT
--  Supabase Dashboard → SQL Editor → Alles markieren → Run
-- ================================================

-- 1. Tabellen anlegen (sicher, falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS bookings (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name           TEXT        NOT NULL,
  email          TEXT        NOT NULL,
  phone          TEXT        NOT NULL,
  event_date     DATE        NOT NULL,
  event_time     TIME        NOT NULL,
  event_time_end TIME,
  guest_count    INTEGER     NOT NULL CHECK (guest_count > 0),
  event_location TEXT,
  message        TEXT,
  status         TEXT        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blocked_dates (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  date       DATE        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Fehlende Spalten ergänzen (sicher, falls bereits vorhanden)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_time_end TIME;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS event_location TEXT;

-- 3. Row Level Security DEAKTIVIEREN
--    Einfachste und zuverlässigste Lösung für anon-Zugriff.
ALTER TABLE bookings      DISABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates DISABLE ROW LEVEL SECURITY;

-- 4. Vollständige Berechtigungen für anon-Rolle
GRANT ALL ON TABLE bookings      TO anon;
GRANT ALL ON TABLE blocked_dates TO anon;

-- 5. Schema-Cache sofort neu laden (behebt den event_location-Fehler)
NOTIFY pgrst, 'reload schema';
