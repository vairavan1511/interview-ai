-- ============================================================
-- analysis-service schema
-- Flyway history isolated via spring.flyway.schemas=analysis_svc
-- ============================================================

CREATE SCHEMA IF NOT EXISTS analysis_svc;

SET search_path TO analysis_svc;

-- ── Attempts ───────────────────────────────────────────────
-- Stores every analysis run. answer_text is stored so users
-- can review past answers; feedback_json is the full AI response.
CREATE TABLE attempts (
    id              BIGSERIAL    PRIMARY KEY,
    user_id         BIGINT       NOT NULL,        -- FK to user_svc.users (cross-schema ref avoided; enforced at app level)
    question_id     BIGINT,                       -- FK to content_svc.questions (cross-schema; app-level)
    question_text   TEXT         NOT NULL,        -- snapshot at time of attempt (question may change)
    answer_text     TEXT         NOT NULL,
    score           SMALLINT     CHECK (score BETWEEN 0 AND 100),
    feedback_json   JSONB,                        -- full structured feedback from AI or rule-based
    provider_used   VARCHAR(30)  NOT NULL DEFAULT 'RULE_BASED',
                                                  -- GEMINI | RULE_BASED
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attempts_user_id    ON attempts(user_id);
CREATE INDEX idx_attempts_created_at ON attempts(user_id, created_at DESC);

-- ── Per-user daily usage caps ──────────────────────────────
-- Checked before every AI call. Resets daily at midnight UTC.
CREATE TABLE usage_caps (
    id           BIGSERIAL   PRIMARY KEY,
    user_id      BIGINT      NOT NULL UNIQUE,
    daily_count  INT         NOT NULL DEFAULT 0,
    reset_date   DATE        NOT NULL DEFAULT CURRENT_DATE,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_caps_user ON usage_caps(user_id);
