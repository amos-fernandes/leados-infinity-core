-- Delete all campaigns for cleanup (this will only affect authenticated user's data due to RLS)
DELETE FROM campaigns;