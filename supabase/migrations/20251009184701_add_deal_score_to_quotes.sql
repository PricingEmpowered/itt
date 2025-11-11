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