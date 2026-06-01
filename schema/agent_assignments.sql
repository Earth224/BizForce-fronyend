-- BizForce AI Phase 2: Executive Agent Task Assignment Engine
-- Production schema for agent_assignments

CREATE TABLE IF NOT EXISTS agent_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    parent_report_id UUID,
    assigned_agent  VARCHAR(50) NOT NULL,
    task_title      VARCHAR(255) NOT NULL,
    task_description TEXT,
    priority        VARCHAR(20) NOT NULL DEFAULT 'Medium'
        CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    status          VARCHAR(20) NOT NULL DEFAULT 'Pending'
        CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Blocked')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    CONSTRAINT agent_assignments_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agent_assignments_user_id
    ON agent_assignments(user_id);

CREATE INDEX IF NOT EXISTS idx_agent_assignments_status
    ON agent_assignments(user_id, status);

CREATE INDEX IF NOT EXISTS idx_agent_assignments_agent
    ON agent_assignments(user_id, assigned_agent);

CREATE INDEX IF NOT EXISTS idx_agent_assignments_parent_report
    ON agent_assignments(parent_report_id);
