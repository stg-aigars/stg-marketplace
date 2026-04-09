-- DAC7 Compliance Schema
-- EU Directive 2021/514 — platform operator reporting obligations
-- Latvia Cabinet Regulation Nr. 97, effective 2023-01-01

-- ============================================================
-- 1. DAC7 fields on user_profiles
-- ============================================================

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS dac7_date_of_birth date,
  ADD COLUMN IF NOT EXISTS dac7_tax_id text,
  ADD COLUMN IF NOT EXISTS dac7_tax_country text,
  ADD COLUMN IF NOT EXISTS dac7_address text,
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS dac7_status text NOT NULL DEFAULT 'not_applicable'
    CHECK (dac7_status IN (
      'not_applicable',
      'approaching',
      'data_requested',
      'reminder_sent',
      'data_provided',
      'blocked'
    )),
  ADD COLUMN IF NOT EXISTS dac7_status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS dac7_first_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS dac7_second_reminder_sent_at timestamptz;

-- Index for queries filtering by actionable DAC7 status
CREATE INDEX IF NOT EXISTS idx_user_profiles_dac7_status
  ON user_profiles (dac7_status)
  WHERE dac7_status <> 'not_applicable';

-- ============================================================
-- 2. DAC7 seller annual stats
-- ============================================================

CREATE TABLE dac7_seller_annual_stats (
  seller_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  calendar_year smallint NOT NULL,
  completed_transaction_count integer NOT NULL DEFAULT 0,
  -- Net of platform commission (items_total - commission), per DAC7 "Consideration" definition
  total_consideration_cents integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (seller_id, calendar_year)
);

ALTER TABLE dac7_seller_annual_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own DAC7 stats"
  ON dac7_seller_annual_stats FOR SELECT
  USING (auth.uid() = seller_id);

-- Threshold monitoring queries
CREATE INDEX idx_dac7_stats_year_thresholds
  ON dac7_seller_annual_stats (calendar_year, completed_transaction_count, total_consideration_cents);

-- ============================================================
-- 3. DAC7 annual reports (audit trail + seller access)
-- ============================================================

CREATE TABLE dac7_annual_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  calendar_year smallint NOT NULL,
  report_data jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  seller_notified_at timestamptz,
  submitted_to_vid_at timestamptz,
  UNIQUE (seller_id, calendar_year)
);

ALTER TABLE dac7_annual_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own DAC7 reports"
  ON dac7_annual_reports FOR SELECT
  USING (auth.uid() = seller_id);

-- ============================================================
-- 4. Add dac7.* prefix to notifications type constraint
-- ============================================================

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type ~ '^(order|comment|offer|dispute|shipping|auction|wanted|dac7)\.');
