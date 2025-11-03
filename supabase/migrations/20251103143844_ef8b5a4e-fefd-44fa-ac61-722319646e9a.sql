-- Add policy to allow inserts for authenticated users
CREATE POLICY "Allow inserts for authenticated users"
ON public.opportunities
FOR INSERT
TO authenticated
WITH CHECK (true);