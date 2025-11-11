/*
  # Add Quote Turnaround Time Tracking

  1. Changes to Tables
    - Add `approval_requested_at` to quotes table
      - Timestamp when quote first enters approval workflow
    - Add `final_approval_at` to quotes table
      - Timestamp when quote receives final approval
    - Add `turnaround_time_hours` to quotes table
      - Calculated field for reporting (hours from request to approval)

  2. New Function
    - `calculate_turnaround_time()` trigger function
      - Automatically calculates turnaround time when final approval is granted
      - Updates turnaround_time_hours field

  3. Purpose
    - Track quote approval turnaround time for performance metrics
    - Enable analysis of approval workflow efficiency
    - Identify bottlenecks in approval process
*/

-- Add timestamp columns to quotes table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'approval_requested_at'
  ) THEN
    ALTER TABLE quotes ADD COLUMN approval_requested_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'final_approval_at'
  ) THEN
    ALTER TABLE quotes ADD COLUMN final_approval_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quotes' AND column_name = 'turnaround_time_hours'
  ) THEN
    ALTER TABLE quotes ADD COLUMN turnaround_time_hours numeric(10,2);
  END IF;
END $$;

-- Create function to calculate turnaround time
CREATE OR REPLACE FUNCTION calculate_quote_turnaround_time()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- When status changes to Approved, calculate turnaround time
  IF NEW.status = 'Approved' AND OLD.status != 'Approved' THEN
    -- Set final approval timestamp
    NEW.final_approval_at := now();
    
    -- Calculate turnaround time if approval_requested_at is set
    IF NEW.approval_requested_at IS NOT NULL THEN
      NEW.turnaround_time_hours := EXTRACT(EPOCH FROM (NEW.final_approval_at - NEW.approval_requested_at)) / 3600;
    END IF;
  END IF;

  -- When status changes to Pending Approval, set requested timestamp if not already set
  IF NEW.status = 'Pending Approval' AND OLD.status != 'Pending Approval' THEN
    IF NEW.approval_requested_at IS NULL THEN
      NEW.approval_requested_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to automatically calculate turnaround time
DROP TRIGGER IF EXISTS trigger_calculate_turnaround_time ON quotes;
CREATE TRIGGER trigger_calculate_turnaround_time
  BEFORE UPDATE ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION calculate_quote_turnaround_time();

-- Create view for turnaround time analytics
CREATE OR REPLACE VIEW quote_turnaround_analytics AS
SELECT 
  q.id,
  q.customer_id,
  c.name as customer_name,
  q.total as quote_total,
  q.status,
  q.approval_requested_at,
  q.final_approval_at,
  q.turnaround_time_hours,
  CASE 
    WHEN q.turnaround_time_hours IS NULL THEN NULL
    WHEN q.turnaround_time_hours < 24 THEN 'Fast (< 1 day)'
    WHEN q.turnaround_time_hours < 72 THEN 'Standard (1-3 days)'
    WHEN q.turnaround_time_hours < 168 THEN 'Slow (3-7 days)'
    ELSE 'Very Slow (> 7 days)'
  END as turnaround_category,
  q.max_approval_level_required,
  q.current_approval_level,
  q.created_at,
  q.created_by
FROM quotes q
LEFT JOIN customers c ON q.customer_id = c.id
WHERE q.approval_requested_at IS NOT NULL;

-- Grant access to the view
GRANT SELECT ON quote_turnaround_analytics TO authenticated;
