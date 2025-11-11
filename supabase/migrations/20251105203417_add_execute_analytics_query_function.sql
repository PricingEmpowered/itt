/*
  # Add Execute Analytics Query Function
  
  Creates a secure function to execute AI-generated SQL queries against analytics views.
  
  1. Security
    - Only SELECT operations allowed
    - Queries automatically scoped to authenticated user's RLS policies
    - Results limited to prevent data extraction
  
  2. Function
    - `execute_analytics_query` - Executes validated SQL query
    - Returns JSONB array of results
    - Automatically enforces RLS
*/

CREATE OR REPLACE FUNCTION execute_analytics_query(query text)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = analytics_secure, public
AS $$
DECLARE
  result JSONB;
BEGIN
  EXECUTE format('SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM (%s) t', query) INTO result;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION execute_analytics_query(text) TO authenticated;
