ALTER TABLE app_users ADD COLUMN email_verified_at TIMESTAMPTZ;
-- Existing accounts must verify too; invalidate pre-migration authenticated sessions.
DELETE FROM SPRING_SESSION;
CREATE TABLE account_codes (
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  purpose VARCHAR(20) NOT NULL CHECK (purpose IN ('VERIFY_EMAIL', 'RESET_PASSWORD')),
  code_hash VARCHAR(100) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, purpose)
);
