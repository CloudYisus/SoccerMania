-- Football Ultimate · esquema inicial PostgreSQL
-- Separación estricta: players (identidad) → player_versions (etapa) → player_cards (edición del usuario).

CREATE TABLE IF NOT EXISTS nations (
  code            TEXT PRIMARY KEY,              -- ISO 3166-1 alpha-2 o subdivisión (gb-eng)
  name            TEXT NOT NULL,
  card_name       TEXT NOT NULL,
  confederation   TEXT NOT NULL,
  api_football_code TEXT                          -- código usado por API-Football si difiere
);

CREATE TABLE IF NOT EXISTS leagues (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  short_name      TEXT NOT NULL,
  nation_code     TEXT NOT NULL REFERENCES nations(code),
  api_football_id INTEGER
);

CREATE TABLE IF NOT EXISTS clubs (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  short_name      TEXT NOT NULL,
  league_id       TEXT NOT NULL REFERENCES leagues(id),
  nation_code     TEXT NOT NULL REFERENCES nations(code),
  color_primary   TEXT NOT NULL,
  color_secondary TEXT NOT NULL,
  api_football_id INTEGER,
  thesportsdb_name TEXT,
  historical      BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE UNIQUE INDEX IF NOT EXISTS clubs_api_football_id_uq ON clubs(api_football_id) WHERE api_football_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS players (
  id              TEXT PRIMARY KEY,
  known_as        TEXT NOT NULL,
  full_name       TEXT NOT NULL,
  nation_code     TEXT NOT NULL REFERENCES nations(code),
  birth_year      INTEGER NOT NULL,
  icon            BOOLEAN NOT NULL DEFAULT FALSE,   -- Icono: propiedad de la identidad, aplica a todas sus versiones
  api_football_id INTEGER
);

CREATE TABLE IF NOT EXISTS player_versions (
  id              TEXT PRIMARY KEY,
  player_id       TEXT NOT NULL REFERENCES players(id),
  label           TEXT NOT NULL,
  season          TEXT NOT NULL,
  club_id         TEXT NOT NULL REFERENCES clubs(id),
  nation_code     TEXT NOT NULL REFERENCES nations(code),
  position        TEXT NOT NULL,
  alt_positions   TEXT[] NOT NULL DEFAULT '{}',
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 99),
  stats           JSONB NOT NULL,                 -- {kind:'outfield'|'goalkeeper', ...6 valores}
  year            SMALLINT NOT NULL,              -- año de edición: define el diseño de la carta
  shirt_number    SMALLINT NOT NULL,
  milestone       TEXT
);
CREATE INDEX IF NOT EXISTS player_versions_player_idx ON player_versions(player_id);
CREATE INDEX IF NOT EXISTS player_versions_year_idx ON player_versions(year);

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY,
  display_name    TEXT NOT NULL,
  coins           BIGINT NOT NULL DEFAULT 0 CHECK (coins >= 0),
  level           INTEGER NOT NULL DEFAULT 1,
  xp              INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS player_cards (
  id              TEXT PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version_id      TEXT NOT NULL REFERENCES player_versions(id),
  source          TEXT NOT NULL,
  acquired_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  loyal           BOOLEAN NOT NULL DEFAULT FALSE,
  games_played    INTEGER NOT NULL DEFAULT 0,
  position_override TEXT,
  untradeable     BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS player_cards_user_idx ON player_cards(user_id);

CREATE TABLE IF NOT EXISTS squads (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  formation_id    TEXT NOT NULL,
  starters        TEXT[] NOT NULL,                -- 11 card ids (NULL permitido)
  bench           TEXT[] NOT NULL,                -- 7 card ids
  manager_id      TEXT,
  tactics         JSONB NOT NULL,
  instructions    JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS market_listings (
  id              UUID PRIMARY KEY,
  seller_user_id  UUID REFERENCES users(id),      -- NULL = mercado IA
  card_id         TEXT REFERENCES player_cards(id),
  version_id      TEXT NOT NULL REFERENCES player_versions(id),
  price           BIGINT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('active','sold','expired','cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolves_at     TIMESTAMPTZ
);

-- Registro de recursos externos (escudos, banderas, retratos, logos) con procedencia.
CREATE TABLE IF NOT EXISTS assets (
  id              TEXT PRIMARY KEY,               -- p. ej. "crest:real-madrid", "flag:br"
  kind            TEXT NOT NULL CHECK (kind IN ('flag','crest','portrait','competition')),
  entity_id       TEXT NOT NULL,
  provider        TEXT NOT NULL,                  -- api-football | thesportsdb | flag-icons | manual
  source_url      TEXT,
  local_path      TEXT,
  status          TEXT NOT NULL CHECK (status IN ('pending','ready','failed','missing')),
  error           TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  license_note    TEXT                            -- procedencia/licencia; verificar derechos antes de publicar
);

CREATE TABLE IF NOT EXISTS provider_sync_log (
  id              BIGSERIAL PRIMARY KEY,
  provider        TEXT NOT NULL,
  operation       TEXT NOT NULL,
  ok              BOOLEAN NOT NULL,
  detail          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
