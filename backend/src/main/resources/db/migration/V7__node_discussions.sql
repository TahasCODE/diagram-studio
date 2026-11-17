CREATE TABLE node_discussions (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    node_id VARCHAR(100) NOT NULL,
    node_label VARCHAR(48) NOT NULL,
    author_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    body VARCHAR(1000) NOT NULL CHECK (length(trim(body)) > 0),
    resolved BOOLEAN NOT NULL DEFAULT false,
    version BIGINT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX node_discussions_project_node_idx ON node_discussions(project_id,node_id,created_at DESC,id DESC);
CREATE INDEX node_discussions_project_created_idx ON node_discussions(project_id,created_at DESC,id DESC);
CREATE TABLE discussion_replies (
    id UUID PRIMARY KEY,
    discussion_id UUID NOT NULL REFERENCES node_discussions(id) ON DELETE CASCADE,
    author_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    body VARCHAR(1000) NOT NULL CHECK (length(trim(body)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX discussion_replies_thread_idx ON discussion_replies(discussion_id,created_at,id);
