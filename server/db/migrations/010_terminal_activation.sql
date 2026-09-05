-- Local storage for the currently-installed TerminalActivationToken
-- (DL-039/DL-046). A singleton per install, same pattern as
-- installation_config (002_multi_tenant.sql) — one Tauri install binds to
-- one terminal. Storing the raw token string alongside its parsed fields
-- means a re-verification (e.g. after a public key rotation) never needs a
-- round trip to re-fetch anything.

CREATE TABLE IF NOT EXISTS terminal_activation_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  token TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  plan_tier TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  activated_at TEXT NOT NULL
);
