-- Add new status values to leads table for the qualification pipeline
-- Update the status field to include the new pipeline statuses

-- First, let's add a check constraint to ensure valid status values
-- We need to update existing leads and add new status options

-- Add new columns for qualification metadata if they don't exist
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS cnpj TEXT,
ADD COLUMN IF NOT EXISTS cnae_principal TEXT,
ADD COLUMN IF NOT EXISTS cidade TEXT,
ADD COLUMN IF NOT EXISTS uf TEXT,
ADD COLUMN IF NOT EXISTS capital_social NUMERIC,
ADD COLUMN IF NOT EXISTS email_encontrado_automaticamente BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS data_qualificacao TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS pontuacao_qualificacao INTEGER;

-- Update status field to accept new values by removing old constraint and adding new one
-- Note: We can't directly alter enum in PostgreSQL, so we use text with check constraint

-- Create index for performance on status queries
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_user_status ON public.leads(user_id, status);

-- Add comment to document the new status flow
COMMENT ON COLUMN public.leads.status IS 'Lead status: NEW -> PROCESSING -> QUALIFIED/UNQUALIFIED -> CONTACTED/ERROR';
COMMENT ON COLUMN public.leads.cnpj IS 'CNPJ found during qualification process';
COMMENT ON COLUMN public.leads.email_encontrado_automaticamente IS 'Whether email was found automatically during qualification';
COMMENT ON COLUMN public.leads.pontuacao_qualificacao IS 'Qualification score from 1-100';