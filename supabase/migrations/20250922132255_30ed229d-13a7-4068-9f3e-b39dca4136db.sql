-- Add status column to contacts table
ALTER TABLE public.contacts ADD COLUMN status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'prospecto'));