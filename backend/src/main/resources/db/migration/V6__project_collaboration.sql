CREATE TABLE project_members (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('EDITOR','VIEWER')),
    accepted BOOLEAN NOT NULL DEFAULT false,
    invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY(project_id,user_id)
);
CREATE INDEX project_members_user_idx ON project_members(user_id,accepted,project_id);
