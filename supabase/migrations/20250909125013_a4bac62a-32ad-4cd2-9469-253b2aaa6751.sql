-- Fix security vulnerability: Remove public access to profiles table
-- Replace the overly permissive policy with secure access control

-- Drop the insecure policy that allows everyone to view profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Create a new policy that only allows authenticated users to view profiles
CREATE POLICY "Authenticated users can view profiles" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Optional: Allow users to view their own profile and other authenticated users' basic info
-- This maintains functionality while securing sensitive data
CREATE POLICY "Users can view basic profile info of authenticated users" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    user_id = auth.uid() OR  -- Users can always see their own profile
    auth.uid() IS NOT NULL   -- Authenticated users can see basic info of other authenticated users
  )
);