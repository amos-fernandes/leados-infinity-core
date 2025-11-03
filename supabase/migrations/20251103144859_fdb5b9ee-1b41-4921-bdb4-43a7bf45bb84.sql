-- Remove the current restrictive policy
DROP POLICY IF EXISTS "Allow inserts for authenticated users" ON public.opportunities;

-- Create a new policy that allows inserts when user_id is provided
CREATE POLICY "Enable insert for authenticated users and service role"
ON public.opportunities
FOR INSERT
TO public
WITH CHECK (
  -- Allow if user is authenticated and user_id matches
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR
  -- Allow service role (bypasses RLS anyway, but explicit is better)
  (auth.jwt() ->> 'role' = 'service_role')
  OR
  -- Allow if user_id is provided (for n8n integration)
  (user_id IS NOT NULL)
);