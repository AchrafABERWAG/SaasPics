-- Add new columns for Plan Type and Couple Names
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'discovery',
ADD COLUMN IF NOT EXISTS groom_name text,
ADD COLUMN IF NOT EXISTS bride_name text;

-- Comment on columns
COMMENT ON COLUMN events.plan_type IS 'The subscription plan: discovery, essential, or premium';
