-- ============================================================
-- content-service schema
-- Flyway history isolated via spring.flyway.schemas=content_svc
-- Designed to support v1 (companies, questions) and v2
-- (papers, DSA test cases, mock test question pools).
-- ============================================================

CREATE SCHEMA IF NOT EXISTS content_svc;

SET search_path TO content_svc;

-- ── Companies ──────────────────────────────────────────────
CREATE TABLE companies (
    id           BIGSERIAL     PRIMARY KEY,
    name         VARCHAR(100)  NOT NULL,
    slug         VARCHAR(100)  NOT NULL UNIQUE,   -- url-safe identifier e.g. "google"
    logo_url     VARCHAR(500),
    description  TEXT,
    tier         SMALLINT      NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 3),
                                                  -- 1=FAANG+, 2=mid-tier, 3=startup
    website_url  VARCHAR(500),
    is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_companies_slug ON companies(slug);

-- ── Hiring rounds ──────────────────────────────────────────
CREATE TABLE hiring_rounds (
    id           BIGSERIAL    PRIMARY KEY,
    company_id   BIGINT       NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    round_type   VARCHAR(50)  NOT NULL,   -- online_assessment | technical | hr | system_design
    title        VARCHAR(150) NOT NULL,
    description  TEXT,
    order_index  SMALLINT     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hiring_rounds_company ON hiring_rounds(company_id);

-- ── Papers (previous-year / sample question papers) ────────
-- v1: metadata + source link only; actual questions linked via questions.paper_id
CREATE TABLE papers (
    id           BIGSERIAL    PRIMARY KEY,
    company_id   BIGINT       NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    year         SMALLINT,                        -- NULL = undated
    title        VARCHAR(200) NOT NULL,
    source_type  VARCHAR(30)  NOT NULL DEFAULT 'ORIGINAL',
                                                  -- ORIGINAL | COMMUNITY | OFFICIAL
    source_url   VARCHAR(500),
    notes        TEXT,
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_papers_company_year ON papers(company_id, year);

-- ── Questions ──────────────────────────────────────────────
CREATE TABLE questions (
    id           BIGSERIAL    PRIMARY KEY,
    company_id   BIGINT       NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    round_id     BIGINT       REFERENCES hiring_rounds(id) ON DELETE SET NULL,
    paper_id     BIGINT       REFERENCES papers(id) ON DELETE SET NULL,

    -- Classification
    type         VARCHAR(30)  NOT NULL,           -- aptitude | dsa | behavioral | system_design
    topic        VARCHAR(100),                    -- e.g. "Arrays", "Leadership", "Scalability"
    difficulty   VARCHAR(10)  NOT NULL DEFAULT 'MEDIUM'
                              CHECK (difficulty IN ('EASY','MEDIUM','HARD')),

    -- Content
    title        VARCHAR(300) NOT NULL,
    body         TEXT         NOT NULL,           -- full question text (Markdown allowed)
    constraints  TEXT,                            -- for DSA: time/space constraints
    examples     TEXT,                            -- for DSA: sample I/O as JSON or Markdown

    -- Source tracking
    source_type  VARCHAR(30)  NOT NULL DEFAULT 'ORIGINAL',
    source_url   VARCHAR(500),

    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_company   ON questions(company_id);
CREATE INDEX idx_questions_type      ON questions(type);
CREATE INDEX idx_questions_paper     ON questions(paper_id);
CREATE INDEX idx_questions_round     ON questions(round_id);

-- ── Question tags ──────────────────────────────────────────
CREATE TABLE tags (
    id    BIGSERIAL    PRIMARY KEY,
    name  VARCHAR(50)  NOT NULL UNIQUE   -- e.g. "hash-map", "two-pointers", "STAR"
);

CREATE TABLE question_tags (
    question_id  BIGINT  NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    tag_id       BIGINT  NOT NULL REFERENCES tags(id)      ON DELETE CASCADE,
    PRIMARY KEY (question_id, tag_id)
);

-- ── Test cases (DSA questions only) ────────────────────────
-- User code is NEVER executed in our services.
-- Test cases are stored here for display / Judge0 submission only.
CREATE TABLE test_cases (
    id               BIGSERIAL  PRIMARY KEY,
    question_id      BIGINT     NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    input            TEXT       NOT NULL,
    expected_output  TEXT       NOT NULL,
    is_hidden        BOOLEAN    NOT NULL DEFAULT FALSE,  -- hidden = not shown to user
    explanation      TEXT,                               -- shown only for visible cases
    order_index      SMALLINT   NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_test_cases_question ON test_cases(question_id);

-- ── Seed: 6 companies (v1 requirement) ─────────────────────
INSERT INTO companies (name, slug, logo_url, description, tier) VALUES
  ('Google',    'google',    NULL, 'Alphabet subsidiary; known for algorithmic interviews.', 1),
  ('Amazon',    'amazon',    NULL, 'Leadership principles + DSA heavy hiring process.',      1),
  ('Microsoft', 'microsoft', NULL, 'Mix of DSA, system design and behaviorals.',             1),
  ('Meta',      'meta',      NULL, 'Strong focus on product sense and coding.',              1),
  ('Flipkart',  'flipkart',  NULL, 'India-based e-commerce; strong DSA rounds.',            2),
  ('Zoho',      'zoho',      NULL, 'India-based SaaS; aptitude + coding focused.',          2);
