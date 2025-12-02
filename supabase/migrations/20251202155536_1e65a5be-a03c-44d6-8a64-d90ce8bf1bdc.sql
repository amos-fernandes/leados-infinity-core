-- =============================================
-- SECURITY FIX: Create separate user_roles table
-- =============================================

-- 1. Create enum for roles
CREATE TYPE public.app_role AS ENUM ('free', 'sdr', 'pro', 'enterprise', 'admin');

-- 2. Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 3. Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- 5. Create function to get user's primary role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_roles WHERE user_id = _user_id ORDER BY 
      CASE role 
        WHEN 'admin' THEN 1 
        WHEN 'enterprise' THEN 2 
        WHEN 'pro' THEN 3 
        WHEN 'sdr' THEN 4 
        WHEN 'free' THEN 5 
      END 
    LIMIT 1),
    'free'::app_role
  )
$$;

-- 6. RLS Policies for user_roles (users can only read their own roles)
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Only service_role can insert/update/delete roles (prevents privilege escalation)
-- No INSERT/UPDATE/DELETE policies for authenticated users

-- 7. Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 
  CASE 
    WHEN role = 'admin' THEN 'admin'::app_role
    WHEN role = 'enterprise' THEN 'enterprise'::app_role
    WHEN role = 'pro' THEN 'pro'::app_role
    WHEN role = 'sdr' THEN 'sdr'::app_role
    ELSE 'free'::app_role
  END
FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- 8. Create trigger to auto-create user role on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.user_id, 'free'::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_add_role
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_profile_role();

-- =============================================
-- SECURITY FIX: Fix overly permissive RLS policies
-- =============================================

-- Fix opportunities INSERT policy
DROP POLICY IF EXISTS "Enable insert for authenticated users and service role" ON public.opportunities;
CREATE POLICY "Users can create their own opportunities"
ON public.opportunities
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Fix scheduled_messages ALL policy (remove it and create specific ones)
DROP POLICY IF EXISTS "System can manage all scheduled messages" ON public.scheduled_messages;

-- Fix scheduler_logs ALL policy
DROP POLICY IF EXISTS "System can manage all scheduler logs" ON public.scheduler_logs;
CREATE POLICY "Users can create their own scheduler logs"
ON public.scheduler_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Update trigger for user_roles
CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();