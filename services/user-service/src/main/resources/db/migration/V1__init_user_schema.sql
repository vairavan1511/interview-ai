-- ============================================================
-- user-service schema
-- Each service owns its own schema; Flyway history table is
-- isolated to this schema via spring.flyway.schemas=user_svc
-- ============================================================

CREATE SCHEMA IF NOT EXISTS user_svc;

SET search_path TO user_svc;

-- ── Users ──────────────────────────────────────────────────
CREATE TABLE users (
    id            BIGSERIAL       PRIMARY KEY,
    email         VARCHAR(255)    NOT NULL UNIQUE,
    password_hash VARCHAR(72)     NOT NULL,   -- BCrypt output is always 60 chars; 72 is safe max
    full_name     VARCHAR(100),
    role          VARCHAR(20)     NOT NULL DEFAULT 'USER',  -- USER | ADMIN
    is_active     BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ── Refresh tokens ─────────────────────────────────────────
-- Stored as a hash (SHA-256) so a DB breach does not expose live tokens.
CREATE TABLE refresh_tokens (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64)  NOT NULL UNIQUE,   -- hex-encoded SHA-256
    expires_at  TIMESTAMPTZ  NOT NULL,
    revoked     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id  ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash     ON refresh_tokens(token_hash);
