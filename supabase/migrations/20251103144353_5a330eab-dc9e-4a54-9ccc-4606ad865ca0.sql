-- Remove old conflicting policy
DROP POLICY IF EXISTS "Users can create their own opportunities" ON public.opportunities;

-- The new policy "Allow inserts for authenticated users" will be used instead