DROP TRIGGER IF EXISTS set_modified_team_monthly_counts ON team_monthly_counts;
DROP TRIGGER IF EXISTS set_modified_poll ON poll;
DROP TRIGGER IF EXISTS set_modified_user ON user_data;
DROP TRIGGER IF EXISTS set_modified_team ON team;

DROP TABLE IF EXISTS team_monthly_counts;
DROP TABLE IF EXISTS poll;
DROP TABLE IF EXISTS user_data;
DROP TABLE IF EXISTS team;

DROP FUNCTION IF EXISTS update_modified_column;


-- Enable pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Function to update the modified timestamp on every update
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table: team
CREATE TABLE team (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),  -- Internal UUID primary key
  team_id TEXT NOT NULL UNIQUE,                   -- External team identifier (e.g., Slack team ID)
  stripe_id TEXT NOT NULL UNIQUE,
  max_count INTEGER NOT NULL,
  expiration_date DATE,
  created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modified TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: update modified on team update
CREATE TRIGGER set_modified_team
BEFORE UPDATE ON team
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Table: user_data
CREATE TABLE user_data (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  slack_token_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modified TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: update modified on user_data update
CREATE TRIGGER set_modified_user
BEFORE UPDATE ON user_data
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Indexes for user_data
CREATE INDEX idx_user_team_id ON user_data(team_id);
CREATE INDEX idx_user_slack_token_id ON user_data(slack_token_id);

-- Table: poll
CREATE TABLE poll (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  callback_id TEXT NOT NULL,
  info JSONB NOT NULL,
  created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modified TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger: update modified on poll update
CREATE TRIGGER set_modified_poll
BEFORE UPDATE ON poll
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- Indexes for poll
CREATE INDEX idx_poll_team_id ON poll(team_id);
CREATE INDEX idx_poll_callback_id ON poll(callback_id);
CREATE INDEX idx_poll_info_jsonb ON poll USING GIN(info);

-- Table: team_monthly_counts
CREATE TABLE team_monthly_counts (
  team_id TEXT NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modified TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, month)
);

-- Indexes for team_monthly_counts
CREATE INDEX idx_team_monthly_counts_team_id ON team_monthly_counts(team_id);
CREATE INDEX idx_team_monthly_counts_month ON team_monthly_counts(month);

-- Trigger: update modified on team_monthly_counts update
CREATE TRIGGER set_modified_team_monthly_counts
BEFORE UPDATE ON team_monthly_counts
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

ALTER TABLE user_data
ADD COLUMN user_id TEXT;

ALTER TABLE user_data
ADD CONSTRAINT user_data_user_id_unique UNIQUE (user_id);


ALTER TABLE team
ALTER COLUMN stripe_id SET NOT NULL;

ALTER TABLE team
ALTER COLUMN max_count DROP NOT NULL;

ALTER TABLE user_data
ALTER COLUMN slack_token_id drop NOT NULL;

ALTER TABLE user_data
ALTER COLUMN access_token drop NOT NULL;

ALTER TABLE team
DROP CONSTRAINT team_team_id_key;