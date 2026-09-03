/*
  # Unique key for deal score recommendations

  DealScoreAnalytics upserts recommendations with
  `onConflict: 'segment_type,segment_value,issue_type'`, but no unique
  constraint on those columns has ever existed, so every one of those writes
  fails with:

    there is no unique or exclusion constraint matching the ON CONFLICT
    specification

  The recommendation regeneration has therefore never persisted anything.
  Adding the constraint the code already assumes makes the upsert work and
  keeps one live recommendation per segment and issue type.

  Duplicates are collapsed first, keeping the most recently created row,
  since the constraint cannot be added while any exist.
*/

DELETE FROM deal_score_recommendations a
      USING deal_score_recommendations b
      WHERE a.segment_type = b.segment_type
        AND a.segment_value = b.segment_value
        AND a.issue_type = b.issue_type
        AND a.created_at < b.created_at;

ALTER TABLE deal_score_recommendations
  DROP CONSTRAINT IF EXISTS deal_score_recommendations_segment_issue_key;

ALTER TABLE deal_score_recommendations
  ADD CONSTRAINT deal_score_recommendations_segment_issue_key
  UNIQUE (segment_type, segment_value, issue_type);
