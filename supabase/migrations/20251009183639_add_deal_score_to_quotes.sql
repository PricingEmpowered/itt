/*
  # Add Deal Score to Quotes

  ## Overview
  This migration adds deal scoring capability to the quotes table. The deal score
  benchmarks each quote against historical pricing data from the same industry and
  region over the past 12 months. A score of 100 represents average performance,
  120 is 20% above average, and 80 is 20% below average.

  ## Changes

  ### 1. New Columns on quotes table
    - `deal_score` (numeric) - Calculated score with 100 as baseline average
      - Scores above 110 indicate excellent deals (green)
      - Scores between 90-110 indicate standard deals (yellow)
      - Scores below 90 indicate poor deals requiring attention (red)
    - `deal_score_details` (jsonb) - Detailed scoring metadata including:
      - Industry average margin and discount
      - Region average margin and discount
      - Comparable deals count
      - Percentile ranking
      - Calculation timestamp
    - `deal_score_calculated_at` (timestamptz) - Timestamp of last calculation

  ### 2. Index
    - Add index on deal_score for efficient filtering and sorting

  ## Security
    - No RLS policy changes needed (inherits from quotes table)

  ## Notes
    - deal_score can be NULL if insufficient historical data exists
    - Score calculation weighs industry and region equally
    - Requires at least 5 comparable historical quotes for accurate scoring
*/

-- Add deal_score column to quotes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'deal_score'
  ) THEN
    ALTER TABLE quotes ADD COLUMN deal_score NUMERIC(6,2);
  END IF;
END $$;

-- Add deal_score_details column to quotes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'deal_score_details'
  ) THEN
    ALTER TABLE quotes ADD COLUMN deal_score_details JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add deal_score_calculated_at column to quotes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'deal_score_calculated_at'
  ) THEN
    ALTER TABLE quotes ADD COLUMN deal_score_calculated_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create index on deal_score for performance
CREATE INDEX IF NOT EXISTS idx_quotes_deal_score ON quotes(deal_score);

-- Add comment to table documenting the deal score feature
COMMENT ON COLUMN quotes.deal_score IS 'Deal quality score normalized to 100 (average). 110+ is excellent, 90-110 is good, below 90 needs attention. Based on margin and discount vs industry/region peers over last 12 months.';
COMMENT ON COLUMN quotes.deal_score_details IS 'JSONB object containing score calculation breakdown: industry_avg_margin, region_avg_margin, industry_avg_discount, region_avg_discount, comparable_deals_count, percentile, calculation_metadata';
COMMENT ON COLUMN quotes.deal_score_calculated_at IS 'Timestamp when deal_score was last calculated. Used to track score freshness and enable recalculation.';
