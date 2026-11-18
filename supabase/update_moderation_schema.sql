-- Add moderation toggle to events
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS moderation_enabled boolean DEFAULT false;

-- Comment
COMMENT ON COLUMN events.moderation_enabled IS 'If true, photos require approval before appearing on Live Wall';
