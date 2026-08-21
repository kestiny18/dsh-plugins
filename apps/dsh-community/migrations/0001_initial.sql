PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  profile_public INTEGER NOT NULL DEFAULT 0 CHECK (profile_public IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE identities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  provider_login TEXT NOT NULL,
  login_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(provider, provider_id),
  UNIQUE(provider, login_key)
);
CREATE INDEX identities_user_idx ON identities(user_id);

CREATE TABLE web_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX web_sessions_user_idx ON web_sessions(user_id);

CREATE TABLE oauth_attempts (
  state_hash TEXT PRIMARY KEY,
  verifier TEXT NOT NULL,
  return_to TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE device_links (
  id TEXT PRIMARY KEY,
  device_code_hash TEXT NOT NULL UNIQUE,
  user_code TEXT NOT NULL UNIQUE,
  installation_id_hash TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  credential_ciphertext TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved')),
  expires_at INTEGER NOT NULL,
  approved_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installation_id_hash TEXT NOT NULL,
  credential_hash TEXT NOT NULL UNIQUE,
  accepted_revision INTEGER NOT NULL DEFAULT 0,
  snapshot_digest TEXT,
  last_synced_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, installation_id_hash)
);
CREATE INDEX devices_user_idx ON devices(user_id);

CREATE TABLE daily_usage (
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  requests INTEGER NOT NULL,
  usage_unavailable_requests INTEGER NOT NULL,
  uncached_input_tokens INTEGER NOT NULL,
  cache_read_tokens INTEGER NOT NULL,
  cache_write_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(device_id, day)
);
CREATE INDEX daily_usage_day_idx ON daily_usage(day);

CREATE TABLE model_usage (
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  requests INTEGER NOT NULL,
  usage_unavailable_requests INTEGER NOT NULL,
  uncached_input_tokens INTEGER NOT NULL,
  cache_read_tokens INTEGER NOT NULL,
  cache_write_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  revision INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(device_id, provider, model)
);
CREATE INDEX model_usage_device_idx ON model_usage(device_id);
