ALTER TABLE app_users ADD COLUMN auth_version BIGINT NOT NULL DEFAULT 0;
-- Existing logins do not carry a credential version yet.
DELETE FROM SPRING_SESSION;
CREATE TABLE account_security_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  action VARCHAR(40) NOT NULL,
  request_id VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX account_security_events_owner_idx ON account_security_events(owner_id,id DESC);
