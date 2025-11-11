/*
  # Remove Duplicate Dashboard Function

  Removes the old parameterless version of get_dashboard_metrics function
  to avoid function ambiguity.
  
  ## Changes
  - Drop the parameterless get_dashboard_metrics() function
  - Keep only the version with p_period_days parameter (defaulting to 30)
*/

-- Drop the old parameterless function
DROP FUNCTION IF EXISTS get_dashboard_metrics();
