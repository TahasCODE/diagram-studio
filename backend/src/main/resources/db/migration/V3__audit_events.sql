CREATE TABLE audit_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL,
    action VARCHAR(40) NOT NULL,
    version BIGINT,
    request_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- No project foreign key: deletion is itself an auditable event.
CREATE INDEX audit_events_owner_id_idx ON audit_events(owner_id, id DESC);
CREATE INDEX audit_events_owner_project_id_idx ON audit_events(owner_id, project_id, id DESC);
