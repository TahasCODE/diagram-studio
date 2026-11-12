CREATE TABLE project_revisions (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version BIGINT NOT NULL CHECK (version > 0),
    title VARCHAR(80) NOT NULL,
    document JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, version)
);

-- Existing drafts get a baseline. Versions saved before this migration cannot be reconstructed.
INSERT INTO project_revisions(project_id, version, title, document, created_at)
SELECT id, version, title, document, updated_at FROM projects;
