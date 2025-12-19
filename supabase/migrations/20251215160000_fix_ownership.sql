-- Migration to fix ownership of orphan records
-- Updates all records with NULL user_id or incorrect user_id to the specified owner

DO $$
DECLARE
  target_user_id UUID := 'ae261289-9866-42dc-9e4e-3d37619b2369';
BEGIN
  -- Update Leads
  UPDATE public.leads
  SET user_id = target_user_id
  WHERE user_id IS NULL OR user_id != target_user_id;

  -- Update Contacts
  UPDATE public.contacts
  SET user_id = target_user_id
  WHERE user_id IS NULL OR user_id != target_user_id;

  -- Update Opportunities
  UPDATE public.opportunities
  SET user_id = target_user_id
  WHERE user_id IS NULL OR user_id != target_user_id;

  -- Update Interactions
  UPDATE public.interactions
  SET user_id = target_user_id
  WHERE user_id IS NULL OR user_id != target_user_id;

  RAISE NOTICE 'Ownership updated for user %', target_user_id;
END $$;
